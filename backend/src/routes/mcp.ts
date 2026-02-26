'use strict';

import { Router, Request, Response, NextFunction } from 'express';

const router = Router();

// POST /api/mcp/tools
router.post('/tools', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.services.mcpService.isConfigured) {
      return res.status(503).json({
        error: 'MCP server is not configured. Set MCP_SERVER_URL in .env',
      });
    }
    const tools = await req.services.mcpService.listTools();
    res.json({ tools });
  } catch (err) {
    next(err);
  }
});

// POST /api/mcp/call
router.post('/call', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.services.mcpService.isConfigured) {
      return res.status(503).json({
        error: 'MCP server is not configured. Set MCP_SERVER_URL in .env',
      });
    }
    const body = req.body as Record<string, unknown>;
    const { tool, args } = body;
    if (!tool) return res.status(400).json({ error: 'tool is required' });

    const result = await req.services.mcpService.callTool(tool as string, (args ?? {}) as Record<string, unknown>);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/mcp/resources
router.post('/resources', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.services.mcpService.isConfigured) {
      return res.status(503).json({ error: 'MCP server is not configured' });
    }
    const resources = await req.services.mcpService.listResources();
    res.json({ resources });
  } catch (err) {
    next(err);
  }
});

// POST /api/mcp/prompts
router.post('/prompts', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.services.mcpService.isConfigured) {
      return res.status(503).json({ error: 'MCP server is not configured' });
    }
    const prompts = await req.services.mcpService.listPrompts();
    res.json({ prompts });
  } catch (err) {
    next(err);
  }
});

export default router;
