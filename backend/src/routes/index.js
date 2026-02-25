'use strict';

const { Router } = require('express');
const multer = require('multer');
const ChatService = require('../services/ChatService');
const KnowledgeService = require('../services/KnowledgeService');
const WebhookService = require('../services/WebhookService');
const McpService = require('../services/McpService');

const chatRouter = require('./chat');
const knowledgeRouter = require('./knowledge');
const webhooksRouter = require('./webhooks');
const settingsRouter = require('./settings');
const mcpRouter = require('./mcp');

const router = Router();

// Instantiate services (singletons shared across routers)
const knowledgeService = new KnowledgeService();
const chatService = new ChatService();
const webhookService = new WebhookService();
const mcpService = new McpService();

// Cross-inject
chatService.setKnowledgeService(knowledgeService);

// Attach services to request context
router.use((req, _res, next) => {
  req.services = { chatService, knowledgeService, webhookService, mcpService };
  next();
});

// Mount routers
router.use('/chats', chatRouter);
router.use('/knowledge-stores', knowledgeRouter);
router.use('/webhooks', webhooksRouter);
router.use('/settings', settingsRouter);
router.use('/mcp', mcpRouter);

// GET /api/providers
router.get('/providers', async (_req, res, next) => {
  try {
    const config = require('../config');

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
        configured: true, // always available if server is running
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
    ];

    res.json({ providers });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
