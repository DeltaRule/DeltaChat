'use strict'

import { Router, Request, Response, NextFunction } from 'express'
import { getToolService } from '../services/ToolService'

const router = Router()

interface AppError extends Error {
  status?: number
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value : undefined
}

// GET /api/tools
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tools = await getToolService().listTools(req.user!.id, req.user!.role)
    res.json(tools)
  } catch (err) {
    next(err)
  }
})

// POST /api/tools
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tool = await getToolService().createTool(
      req.body as Record<string, unknown>,
      req.user!.id,
    )
    res.status(201).json(tool)
  } catch (err) {
    const e = err as AppError
    if (e.status) return res.status(e.status).json({ error: e.message })
    next(err)
  }
})

// GET /api/tools/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const tool = await getToolService().getTool(req.params['id'] as string)
    if (!tool) return res.status(404).json({ error: 'Tool not found' })
    res.json(tool)
  } catch (err) {
    next(err)
  }
})

// PUT /api/tools/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const updated = await getToolService().updateTool(
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

// DELETE /api/tools/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await getToolService().deleteTool(req.params['id'] as string, req.user!.id, req.user!.role)
    res.json({ ok: true })
  } catch (err) {
    const e = err as AppError
    if (e.status) return res.status(e.status).json({ error: e.message })
    next(err)
  }
})

// POST /api/tools/:id/execute
router.post('/:id/execute', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const toolService = getToolService()
    const tool = await toolService.getTool(req.params['id'] as string)
    if (!tool) return res.status(404).json({ error: 'Tool not found' })

    const hasAccess = await toolService.checkAccess(req.user!.id, req.user!.role, tool)
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
