'use strict'

import { Router, Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'
import { getAdapter } from '../db/DeltaDatabaseAdapter'
import { getSharingService } from '../services/SharingService'

const router = Router()

// GET /api/models
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    const models = await db.listAiModels()
    const sharingService = getSharingService()
    const filtered = await sharingService.filterAccessible(
      req.user!.id,
      req.user!.role,
      'ai_model',
      models,
    )
    const annotated = filtered.map((m) => ({ ...m, _sharedWithMe: m['ownerId'] !== req.user!.id }))
    res.json(annotated)
  } catch (err) {
    next(err)
  }
})

// POST /api/models
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    const body = req.body as Record<string, unknown>
    const model = await db.createAiModel({
      id: randomUUID(),
      name: body['name'] ?? 'Unnamed Model',
      description: body['description'] ?? null,
      type: body['type'] ?? 'model',
      provider: body['provider'] ?? null,
      providerModel: body['providerModel'] ?? null,
      systemPrompt: body['systemPrompt'] ?? null,
      temperature: body['temperature'] ?? null,
      maxTokens: body['maxTokens'] ?? null,
      knowledgeStoreIds: body['knowledgeStoreIds'] ?? [],
      toolIds: body['toolIds'] ?? [],
      webhookId: body['webhookId'] ?? null,
      agentId: body['agentId'] ?? null,
      enabled: body['enabled'] !== false,
      ownerId: req.user!.id,
    })
    res.status(201).json(model)
  } catch (err) {
    next(err)
  }
})

// GET /api/models/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    const model = await db.getAiModel(req.params.id as string)
    if (!model) return res.status(404).json({ error: 'Model not found' })
    res.json(model)
  } catch (err) {
    next(err)
  }
})

// PUT /api/models/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    const model = await db.getAiModel(req.params.id as string)
    if (!model) return res.status(404).json({ error: 'Model not found' })
    if (model['ownerId'] && model['ownerId'] !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only the owner or an admin can edit this model' })
    }
    const updated = await db.updateAiModel(
      req.params.id as string,
      req.body as Record<string, unknown>,
    )
    res.json(updated)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/models/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    const model = await db.getAiModel(req.params.id as string)
    if (!model) return res.status(404).json({ error: 'Model not found' })
    if (model['ownerId'] && model['ownerId'] !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only the owner or an admin can delete this model' })
    }
    await db.deleteAiModel(req.params.id as string)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
