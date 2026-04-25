'use strict'

import { Router, Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'
import { getAdapter } from '../db/DeltaDatabaseAdapter'
import { isAllowedExternalUrl, isPrivateOrLocalhost } from '../utils/ssrf'

const router = Router()

// ── Shared validation helpers ──────────────────────────────────────────────

/**
 * Validate the serverUrl field against the connection scope + user role rules:
 *
 * - scope 'client'  → any localhost/private URL allowed (browser calls it directly); skip SSRF
 * - scope 'server'  → if URL is localhost/private, only admins may save it
 *                     if URL is external, standard SSRF guard applies
 *
 * Returns an error string if invalid, null if valid.
 */
function validateServerUrl(
  rawUrl: string,
  scope: 'server' | 'client',
  isAdmin: boolean,
): string | null {
  let parsed: URL
  try {
    parsed = new URL(rawUrl)
  } catch {
    return 'serverUrl must be a valid URL'
  }

  // Only HTTP/HTTPS allowed
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    return 'serverUrl must use http or https'
  }

  // Reject embedded credentials regardless of scope
  if (parsed.username || parsed.password) {
    return 'serverUrl must not contain embedded credentials'
  }

  if (scope === 'client') {
    // Client-side connections call localhost from the browser — no SSRF risk on the server
    return null
  }

  // scope === 'server'
  if (isPrivateOrLocalhost(rawUrl)) {
    if (!isAdmin) {
      return 'Only admins may add server-side connections to localhost or private network addresses'
    }
    // Admin is allowed to point to localhost (e.g. MCP server co-located with backend)
    return null
  }

  // External URL → standard SSRF guard
  if (!isAllowedExternalUrl(rawUrl)) {
    return 'serverUrl must point to an allowed network address'
  }

  return null
}

// GET /api/mcp-connections
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    const all = await db.listMcpConnections()
    // Client-scope connections are strictly private (owner-only).
    // Server-scope connections: users see their own + unowned; admins see all.
    const userId = req.user!.id
    const isAdmin = req.user!.role === 'admin'
    const filtered = isAdmin
      ? all
      : all.filter((c) => {
          if (c['connectionScope'] === 'client') return c['ownerId'] === userId
          return c['ownerId'] === userId || !c['ownerId']
        })
    res.json(filtered)
  } catch (err) {
    next(err)
  }
})

// POST /api/mcp-connections
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    const body = req.body as Record<string, unknown>

    const serverUrl = typeof body['serverUrl'] === 'string' ? body['serverUrl'].trim() : ''
    if (!serverUrl) {
      return res.status(400).json({ error: 'serverUrl is required' })
    }

    const scope: 'server' | 'client' = body['connectionScope'] === 'client' ? 'client' : 'server'
    const transportType: 'http' | 'sse' =
      scope === 'server' && body['transportType'] === 'sse' ? 'sse' : 'http'
    const apiKey =
      typeof body['apiKey'] === 'string' && body['apiKey'].trim() ? body['apiKey'].trim() : null
    const isAdmin = req.user!.role === 'admin'

    const urlError = validateServerUrl(serverUrl, scope, isAdmin)
    if (urlError) return res.status(400).json({ error: urlError })

    const now = new Date().toISOString()
    const conn = await db.createMcpConnection({
      id: randomUUID(),
      name: body['name'] ?? 'Unnamed MCP Server',
      serverUrl,
      timeout: typeof body['timeout'] === 'number' ? body['timeout'] : 30000,
      connectionScope: scope,
      transportType,
      apiKey,
      // Client-scope connections are always owned by the creating user
      ownerId: scope === 'client' ? req.user!.id : (req.user!.id ?? null),
      createdAt: now,
      updatedAt: now,
    })
    res.status(201).json(conn)
  } catch (err) {
    next(err)
  }
})

// GET /api/mcp-connections/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    const conn = await db.getMcpConnection(req.params.id as string)
    if (!conn) return res.status(404).json({ error: 'MCP connection not found' })
    // Client-scope: strictly owner-only (not even unowned access)
    if (conn['connectionScope'] === 'client') {
      if (conn['ownerId'] !== req.user!.id && req.user!.role !== 'admin') {
        return res.status(403).json({ error: 'Access denied' })
      }
    } else if (conn['ownerId'] && conn['ownerId'] !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied' })
    }
    res.json(conn)
  } catch (err) {
    next(err)
  }
})

// PUT /api/mcp-connections/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    const conn = await db.getMcpConnection(req.params.id as string)
    if (!conn) return res.status(404).json({ error: 'MCP connection not found' })
    if (conn['ownerId'] && conn['ownerId'] !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only the owner or an admin can edit this connection' })
    }

    const body = req.body as Record<string, unknown>
    const isAdmin = req.user!.role === 'admin'

    // Determine effective scope (use new value if provided, else existing)
    const newScope = body['connectionScope']
    const effectiveScope: 'server' | 'client' =
      newScope === 'client' || newScope === 'server'
        ? (newScope as 'server' | 'client')
        : ((conn['connectionScope'] as 'server' | 'client') ?? 'server')

    // Re-validate URL if changed
    if (typeof body['serverUrl'] === 'string') {
      const url = body['serverUrl'].trim()
      if (!url) return res.status(400).json({ error: 'serverUrl cannot be empty' })
      const urlError = validateServerUrl(url, effectiveScope, isAdmin)
      if (urlError) return res.status(400).json({ error: urlError })
      body['serverUrl'] = url
    }

    // Validate transportType change: SSE only for server-scope
    if (body['transportType'] !== undefined) {
      if (effectiveScope === 'client' && body['transportType'] === 'sse') {
        return res
          .status(400)
          .json({ error: 'SSE transport is only available for server-scope connections' })
      }
    }

    // Trim apiKey
    if (typeof body['apiKey'] === 'string') {
      body['apiKey'] = body['apiKey'].trim() || null
    }

    body['connectionScope'] = effectiveScope
    body['updatedAt'] = new Date().toISOString()
    const updated = await db.updateMcpConnection(req.params.id as string, body)
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/mcp-connections/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    const conn = await db.getMcpConnection(req.params.id as string)
    if (!conn) return res.status(404).json({ error: 'MCP connection not found' })
    if (conn['ownerId'] && conn['ownerId'] !== req.user!.id && req.user!.role !== 'admin') {
      return res
        .status(403)
        .json({ error: 'Only the owner or an admin can delete this connection' })
    }
    await db.deleteMcpConnection(req.params.id as string)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// GET /api/mcp-connections/:id/tools — fetch available tools via the backend proxy
// Only valid for server-scope connections (backend can reach that URL).
router.get('/:id/tools', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    const conn = await db.getMcpConnection(req.params.id as string)
    if (!conn) return res.status(404).json({ error: 'MCP connection not found' })
    if (conn['ownerId'] && conn['ownerId'] !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied to this MCP connection' })
    }

    // Client-scope connections cannot be proxied — the browser must call them directly
    if (conn['connectionScope'] === 'client') {
      return res.status(400).json({
        error:
          'Client-scope connections cannot be fetched via the backend. ' +
          'Use the browser-direct API from the frontend instead.',
      })
    }

    const serverUrl = conn['serverUrl'] as string
    const timeout = (conn['timeout'] as number) || 30000
    const transportType = (conn['transportType'] as 'http' | 'sse') ?? 'http'
    const apiKey = typeof conn['apiKey'] === 'string' && conn['apiKey'] ? conn['apiKey'] : undefined

    const tools = await req.services.mcpService.listToolsWithUrl(
      serverUrl,
      timeout,
      transportType,
      apiKey,
    )
    res.json({ tools })
  } catch (err) {
    next(err)
  }
})

export default router
