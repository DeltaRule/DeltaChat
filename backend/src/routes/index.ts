'use strict'

import { Router, Request, Response, NextFunction } from 'express'
import ChatService from '../services/ChatService'
import KnowledgeService from '../services/KnowledgeService'
import WebhookService from '../services/WebhookService'
import McpService from '../services/McpService'
import { ToolExecutionService } from '../services/ToolExecutionService'
import { getAdapter } from '../db/DeltaDatabaseAdapter'

import { requireAuth } from '../middleware/auth'
import authRouter from './auth'
import chatRouter from './chat'
import knowledgeRouter from './knowledge'
import webhooksRouter from './webhooks'
import settingsRouter from './settings'
import mcpRouter from './mcp'
import modelsRouter from './models'
import agentsRouter from './agents'
import toolsRouter from './tools'
import usersRouter from './users'
import userGroupsRouter from './user-groups'
import sharingRouter from './sharing'
import mcpConnectionsRouter from './mcpConnections'

const router = Router()

const knowledgeService = new KnowledgeService()
const chatService = new ChatService()
const webhookService = new WebhookService()
const mcpService = new McpService()

chatService.setKnowledgeService(knowledgeService)

// Export shared singletons for use in WebSocket path (server.ts) so that per-socket
// code doesn't create new instances on every event — resolves G-B13.
export { chatService, knowledgeService, webhookService, mcpService }

// Service injection — available to all subsequent routes
router.use(async (req: Request, _res: Response, next: NextFunction) => {
  const db = getAdapter()
  const settings = (await db.getSettings()) as Record<string, unknown>
  const executorsConfig = (settings['executors'] as Record<string, unknown>) || {}
  const toolExecutionService = new ToolExecutionService(mcpService, {
    python: executorsConfig['python'] as any,
    typescript: executorsConfig['typescript'] as any,
  })
  req.services = { chatService, knowledgeService, webhookService, mcpService, toolExecutionService }
  next()
})

// ── Public routes (no auth required) ──────────────────────────────────────
router.use('/auth', authRouter)

// ── Protected routes (auth required) ──────────────────────────────────────
router.use(requireAuth)

router.use('/chats', chatRouter)
router.use('/knowledge', knowledgeRouter)
router.use('/knowledge-stores', knowledgeRouter) // alias for backwards compat
router.use('/webhooks', webhooksRouter)
router.use('/settings', settingsRouter)
router.use('/mcp', mcpRouter)
router.use('/models', modelsRouter)
router.use('/agents', agentsRouter)
router.use('/tools', toolsRouter)
router.use('/users', usersRouter)
router.use('/user-groups', userGroupsRouter)
router.use('/sharing', sharingRouter)
router.use('/mcp-connections', mcpConnectionsRouter)

// GET /api/providers
router.get('/providers', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const config = (await import('../config')).default

    const providers = [
      {
        name: 'openai',
        type: 'model',
        configured: Boolean(config.openai.apiKey),
        defaultModel: config.openai.defaultModel,
      },
      {
        name: 'gemini',
        type: 'model',
        configured: Boolean(config.gemini.apiKey),
        defaultModel: config.gemini.defaultModel,
      },
      {
        name: 'ollama',
        type: 'model+embedding',
        configured: true,
        baseUrl: config.ollama.baseUrl,
      },
      {
        name: 'chroma',
        type: 'vectorstore',
        configured: true,
        url: config.chroma.url,
      },
      {
        name: 'tika',
        type: 'processor',
        configured: true,
        url: config.tika.url,
      },
      {
        name: 'docling',
        type: 'processor',
        configured: true,
        url: config.docling.url,
      },
      {
        name: 'mcp',
        type: 'tool-server',
        configured: Boolean(config.mcp.serverUrl),
        url: config.mcp.serverUrl || null,
      },
    ]

    res.json({ providers })
  } catch (err) {
    next(err)
  }
})

export default router
