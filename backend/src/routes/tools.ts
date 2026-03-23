'use strict'

import { Router, Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'
import { getAdapter } from '../db/DeltaDatabaseAdapter'
import type { Entity } from '../db/DeltaDatabaseAdapter'
import { getSharingService } from '../services/SharingService'

const router = Router()

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

async function ensureToolAccess(userId: string, userRole: string, tool: Entity): Promise<boolean> {
  if (userRole === 'admin') return true
  if (tool['ownerId'] === userId) return true
  const sharingService = getSharingService()
  const allowed = await sharingService.filterAccessible(userId, userRole, 'tool', [tool])
  return allowed.length > 0
}

// GET /api/tools
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    const tools = await db.listTools()
    const sharingService = getSharingService()
    const filtered = await sharingService.filterAccessible(
      req.user!.id,
      req.user!.role,
      'tool',
      tools,
    )
    const annotated = filtered.map((t) => ({ ...t, _sharedWithMe: t['ownerId'] !== req.user!.id }))
    res.json(annotated)
  } catch (err) {
    next(err)
  }
})

// POST /api/tools
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    const body = req.body as Record<string, unknown>

    // Validate tool type
    const type = body['type'] as string
    const validTypes = ['mcp', 'python', 'typescript']
    if (!validTypes.includes(type)) {
      return res.status(400).json({
        error: `Invalid tool type. Must be one of: ${validTypes.join(', ')}`,
      })
    }

    const tool = await db.createTool({
      id: randomUUID(),
      name: body['name'] ?? 'Unnamed Tool',
      description: body['description'] ?? null,
      type,
      config: body['config'] ?? {},
      enabled: body['enabled'] !== false,
      ownerId: req.user!.id,
    })
    res.status(201).json(tool)
  } catch (err) {
    next(err)
  }
})

// GET /api/tools/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    const tool = await db.getTool(req.params.id as string)
    if (!tool) return res.status(404).json({ error: 'Tool not found' })
    res.json(tool)
  } catch (err) {
    next(err)
  }
})

// PUT /api/tools/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    const tool = await db.getTool(req.params.id as string)
    if (!tool) return res.status(404).json({ error: 'Tool not found' })
    if (tool['ownerId'] && tool['ownerId'] !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only the owner or an admin can edit this tool' })
    }
    const body = req.body as Record<string, unknown>
    if (typeof body['type'] === 'string') {
      const validTypes = ['mcp', 'python', 'typescript']
      if (!validTypes.includes(body['type'])) {
        return res.status(400).json({
          error: `Invalid tool type. Must be one of: ${validTypes.join(', ')}`,
        })
      }
    }
    const updated = await db.updateTool(req.params.id as string, body)
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/tools/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    const tool = await db.getTool(req.params.id as string)
    if (!tool) return res.status(404).json({ error: 'Tool not found' })
    if (tool['ownerId'] && tool['ownerId'] !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only the owner or an admin can delete this tool' })
    }
    await db.deleteTool(req.params.id as string)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// POST /api/tools/:id/execute
router.post('/:id/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    const tool = (await db.getTool(req.params.id as string)) as Entity | null
    if (!tool) return res.status(404).json({ error: 'Tool not found' })

    const hasAccess = await ensureToolAccess(req.user!.id, req.user!.role, tool)
    if (!hasAccess) {
      return res.status(403).json({ error: 'You do not have access to this tool' })
    }

    const body = req.body as Record<string, unknown>
    const args = asRecord(body['args'])

    try {
      const result = await req.services.toolExecutionService.executeTool(
        {
          id: tool['id'] as string,
          name: tool['name'] as string,
          type: tool['type'] as 'mcp' | 'python' | 'typescript',
          config: asRecord(tool['config']),
          description: asString(tool['description']),
          enabled: tool['enabled'] !== false,
        },
        args,
      )
      // Return bare result value
      return res.json(result)
    } catch (err) {
      const e = err as Error
      const status = /timed out/i.test(e.message) ? 504 : 502
      return res.status(status).json({ error: e.message || 'Tool execution failed' })
    }
  } catch (err) {
    next(err)
  }
})

export default router
