'use strict'

import { Router, Request, Response, NextFunction } from 'express'
import axios from 'axios'
import { getAdapter } from '../db/DeltaDatabaseAdapter'

const router = Router()

// POST /api/mcp/proxy  — CORS-free proxy: frontend sends MCP JSON-RPC through backend
router.post('/proxy', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = req.body as Record<string, unknown>
    const connectionId = body['connectionId'] as string | undefined
    const method = body['method'] as string | undefined
    const params = (body['params'] ?? {}) as Record<string, unknown>

    if (!connectionId) return res.status(400).json({ error: 'connectionId is required' })
    if (!method) return res.status(400).json({ error: 'method is required' })

    const db = getAdapter()
    const conn = await db.getMcpConnection(connectionId)
    if (!conn) return res.status(404).json({ error: 'MCP connection not found' })

    // Access check
    if (conn['ownerId'] && conn['ownerId'] !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Access denied to this MCP connection' })
    }

    const serverUrl = conn['serverUrl'] as string
    const timeout = (conn['timeout'] as number) || 30000

    const rpcRequest = {
      jsonrpc: '2.0',
      id: Date.now(),
      method,
      params,
    }

    const response = await axios.post(serverUrl, rpcRequest, {
      timeout,
      headers: { 'Content-Type': 'application/json' },
    })

    res.json(response.data)
  } catch (err) {
    next(err)
  }
})

// POST /api/mcp/tools
router.post('/tools', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.services.mcpService.isConfigured) {
      return res.status(503).json({
        error: 'MCP server is not configured. Set MCP_SERVER_URL in .env',
      })
    }
    const tools = await req.services.mcpService.listTools()
    res.json({ tools })
  } catch (err) {
    next(err)
  }
})

// POST /api/mcp/call
router.post('/call', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.services.mcpService.isConfigured) {
      return res.status(503).json({
        error: 'MCP server is not configured. Set MCP_SERVER_URL in .env',
      })
    }
    const body = req.body as Record<string, unknown>
    const { tool, args } = body
    if (!tool) return res.status(400).json({ error: 'tool is required' })

    const result = await req.services.mcpService.callTool(
      tool as string,
      (args ?? {}) as Record<string, unknown>,
    )
    res.json(result)
  } catch (err) {
    next(err)
  }
})

// POST /api/mcp/resources
router.post('/resources', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.services.mcpService.isConfigured) {
      return res.status(503).json({ error: 'MCP server is not configured' })
    }
    const resources = await req.services.mcpService.listResources()
    res.json({ resources })
  } catch (err) {
    next(err)
  }
})

// POST /api/mcp/prompts
router.post('/prompts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.services.mcpService.isConfigured) {
      return res.status(503).json({ error: 'MCP server is not configured' })
    }
    const prompts = await req.services.mcpService.listPrompts()
    res.json({ prompts })
  } catch (err) {
    next(err)
  }
})

export default router
