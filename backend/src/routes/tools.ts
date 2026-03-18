'use strict'

import { Router, Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'
import { getAdapter } from '../db/DeltaDatabaseAdapter'
import { getSharingService } from '../services/SharingService'

const router = Router()

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
    const tool = await db.createTool({
      id: randomUUID(),
      name: body['name'] ?? 'Unnamed Tool',
      description: body['description'] ?? null,
      type: body['type'] ?? 'mcp',
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
    const updated = await db.updateTool(
      req.params.id as string,
      req.body as Record<string, unknown>,
    )
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

export default router
