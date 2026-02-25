'use strict';

const { Router } = require('express');

const router = Router();

// POST /api/mcp/tools  – list available MCP tools
router.post('/tools', async (req, res, next) => {
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

// POST /api/mcp/call  – call an MCP tool
router.post('/call', async (req, res, next) => {
  try {
    if (!req.services.mcpService.isConfigured) {
      return res.status(503).json({
        error: 'MCP server is not configured. Set MCP_SERVER_URL in .env',
      });
    }
    const { tool, args } = req.body;
    if (!tool) return res.status(400).json({ error: 'tool is required' });

    const result = await req.services.mcpService.callTool(tool, args || {});
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/mcp/resources  – list MCP resources
router.post('/resources', async (req, res, next) => {
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

// POST /api/mcp/prompts  – list MCP prompts
router.post('/prompts', async (req, res, next) => {
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

module.exports = router;
