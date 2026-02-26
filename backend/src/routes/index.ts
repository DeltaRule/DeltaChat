'use strict';

import { Router, Request, Response, NextFunction } from 'express';
import ChatService from '../services/ChatService';
import KnowledgeService from '../services/KnowledgeService';
import WebhookService from '../services/WebhookService';
import McpService from '../services/McpService';

import chatRouter from './chat';
import knowledgeRouter from './knowledge';
import webhooksRouter from './webhooks';
import settingsRouter from './settings';
import mcpRouter from './mcp';

const router = Router();

const knowledgeService = new KnowledgeService();
const chatService = new ChatService();
const webhookService = new WebhookService();
const mcpService = new McpService();

chatService.setKnowledgeService(knowledgeService);

router.use((req: Request, _res: Response, next: NextFunction) => {
  req.services = { chatService, knowledgeService, webhookService, mcpService };
  next();
});

router.use('/chats', chatRouter);
router.use('/knowledge-stores', knowledgeRouter);
router.use('/webhooks', webhooksRouter);
router.use('/settings', settingsRouter);
router.use('/mcp', mcpRouter);

// GET /api/providers
router.get('/providers', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const config = (await import('../config')).default;

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
    ];

    res.json({ providers });
  } catch (err) {
    next(err);
  }
});

export default router;
