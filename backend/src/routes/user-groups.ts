'use strict'

import { Router, Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'
import { requireAuth, requireAdmin } from '../middleware/auth'
import { getAdapter } from '../db/DeltaDatabaseAdapter'

const router = Router()

router.use(requireAuth, requireAdmin)

// GET /api/user-groups
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    const groups = await db.listUserGroups()
    res.json(groups)
  } catch (err) {
    next(err)
  }
})

// POST /api/user-groups
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as Record<string, unknown>
    const db = getAdapter()
    const group = await db.createUserGroup({
      id: randomUUID(),
      name: body['name'] ?? 'Unnamed Group',
      description: body['description'] ?? null,
      memberIds: body['memberIds'] ?? [],
      externalId: body['externalId'] ?? null,
      metadata: body['metadata'] ?? {},
    })
    res.status(201).json(group)
  } catch (err) {
    next(err)
  }
})

// GET /api/user-groups/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    const group = await db.getUserGroup(req.params.id as string)
    if (!group) return res.status(404).json({ error: 'Group not found' })
    res.json(group)
  } catch (err) {
    next(err)
  }
})

// PUT /api/user-groups/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    const group = await db.updateUserGroup(
      req.params.id as string,
      req.body as Record<string, unknown>,
    )
    if (!group) return res.status(404).json({ error: 'Group not found' })
    res.json(group)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/user-groups/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    // Cascade: remove shares targeting this group
    await db.deleteResourceSharesByTarget('group', req.params.id as string)
    await db.deleteUserGroup(req.params.id as string)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// POST /api/user-groups/:id/members
router.post('/:id/members', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as Record<string, unknown>
    const userIds = (body['userIds'] || body['memberIds']) as string[] | undefined
    if (!Array.isArray(userIds)) return res.status(400).json({ error: 'userIds array required' })
    const db = getAdapter()
    const group = await db.getUserGroup(req.params.id as string)
    if (!group) return res.status(404).json({ error: 'Group not found' })
    const existing = (group['memberIds'] as string[]) || []
    const merged = [...new Set([...existing, ...userIds])]
    const updated = await db.updateUserGroup(req.params.id as string, { memberIds: merged })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/user-groups/:id/members
router.delete('/:id/members', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as Record<string, unknown>
    const userIds = (body['userIds'] || body['memberIds']) as string[] | undefined
    if (!Array.isArray(userIds)) return res.status(400).json({ error: 'userIds array required' })
    const db = getAdapter()
    const group = await db.getUserGroup(req.params.id as string)
    if (!group) return res.status(404).json({ error: 'Group not found' })
    const existing = (group['memberIds'] as string[]) || []
    const filtered = existing.filter((id) => !userIds.includes(id))
    const updated = await db.updateUserGroup(req.params.id as string, { memberIds: filtered })
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

export default router
