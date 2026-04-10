'use strict'

import { Router, Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'
import { getAdapter } from '../db/DeltaDatabaseAdapter'

const router = Router()

// GET /api/mcp-connections
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    const all = await db.listMcpConnections()
    // Users see their own connections; admins see all
    const filtered =
      req.user!.role === 'admin'
        ? all
        : all.filter((c) => c['ownerId'] === req.user!.id || !c['ownerId'])
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

    // Basic URL validation
    try {
      new URL(serverUrl)
    } catch {
      return res.status(400).json({ error: 'serverUrl must be a valid URL' })
    }

    const now = new Date().toISOString()
    const conn = await db.createMcpConnection({
      id: randomUUID(),
      name: body['name'] ?? 'Unnamed MCP Server',
      serverUrl,
      timeout: typeof body['timeout'] === 'number' ? body['timeout'] : 30000,
      ownerId: req.user!.id,
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
    if (conn['ownerId'] && conn['ownerId'] !== req.user!.id && req.user!.role !== 'admin') {
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

    // Validate serverUrl if provided
    if (typeof body['serverUrl'] === 'string') {
      const url = body['serverUrl'].trim()
      if (!url) return res.status(400).json({ error: 'serverUrl cannot be empty' })
      try {
        new URL(url)
      } catch {
        return res.status(400).json({ error: 'serverUrl must be a valid URL' })
      }
      body['serverUrl'] = url
    }

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

export default router
