'use strict'

import { Router, Request, Response, NextFunction } from 'express'
import { getAgentService } from '../services/AgentService'

interface AppError extends Error {
  status?: number
}

const router = Router()

// GET /api/agents
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agents = await getAgentService().listAgents(req.user!.id, req.user!.role)
    res.json(agents)
  } catch (err) {
    next(err)
  }
})

// POST /api/agents
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agent = await getAgentService().createAgent(
      req.body as Record<string, unknown>,
      req.user!.id,
    )
    res.status(201).json(agent)
  } catch (err) {
    next(err)
  }
})

// GET /api/agents/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const agent = await getAgentService().getAgent(req.params['id'] as string)
    if (!agent) return res.status(404).json({ error: 'Agent not found' })
    res.json(agent)
  } catch (err) {
    next(err)
  }
})

// PUT /api/agents/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await getAgentService().updateAgent(
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

// DELETE /api/agents/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await getAgentService().deleteAgent(req.params['id'] as string, req.user!.id, req.user!.role)
    res.json({ ok: true })
  } catch (err) {
    const e = err as AppError
    if (e.status) return res.status(e.status).json({ error: e.message })
    next(err)
  }
})

export default router
