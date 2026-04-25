'use strict'

import { Router, Request, Response, NextFunction } from 'express'
import { getModelService } from '../services/ModelService'

const router = Router()

interface AppError extends Error {
  status?: number
}

// GET /api/models
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const models = await getModelService().listModels(req.user!.id, req.user!.role)
    res.json(models)
  } catch (err) {
    next(err)
  }
})

// POST /api/models
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const model = await getModelService().createModel(
      req.body as Record<string, unknown>,
      req.user!.id,
    )
    res.status(201).json(model)
  } catch (err) {
    next(err)
  }
})

// GET /api/models/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const model = await getModelService().getModel(req.params['id'] as string)
    if (!model) return res.status(404).json({ error: 'Model not found' })
    res.json(model)
  } catch (err) {
    next(err)
  }
})

// PUT /api/models/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await getModelService().updateModel(
      req.params['id'] as string,
      req.body as Record<string, unknown>,
      req.user!.id,
      req.user!.role,
    )
    res.json(updated)
  } catch (err) {
    const e = err as AppError
    if (e.status) return res.status(e.status).json({ error: e.message })
    next(err)
  }
})

// DELETE /api/models/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await getModelService().deleteModel(req.params['id'] as string, req.user!.id, req.user!.role)
    res.json({ ok: true })
  } catch (err) {
    const e = err as AppError
    if (e.status) return res.status(e.status).json({ error: e.message })
    next(err)
  }
})

export default router
