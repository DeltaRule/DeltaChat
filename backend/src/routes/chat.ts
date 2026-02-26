'use strict';

import { Router, Request, Response, NextFunction } from 'express';

const router = Router();

// POST /api/chats
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chat = await req.services.chatService.createChat(req.body as Record<string, unknown>);
    res.status(201).json(chat);
  } catch (err) {
    next(err);
  }
});

// GET /api/chats
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chats = await req.services.chatService.listChats();
    res.json(chats);
  } catch (err) {
    next(err);
  }
});

// GET /api/chats/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chat = await req.services.chatService.getChat(req.params.id as string);
    res.json(chat);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/chats/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chat = await req.services.chatService.updateChat(req.params.id as string, req.body as Record<string, unknown>);
    res.json(chat);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/chats/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await req.services.chatService.deleteChat(req.params.id as string);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/chats/:id/messages
router.post('/:id/messages', async (req: Request, res: Response, next: NextFunction) => {
  const body = req.body as Record<string, unknown>;
  const { content, stream: streamRequested, ...opts } = body;
  const chatId = req.params.id as string;

  if (!content) {
    return res.status(400).json({ error: 'content is required' });
  }

  const wantsStream =
    streamRequested === true || req.headers.accept === 'text/event-stream';

  if (wantsStream) {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    await req.services.chatService.streamMessage(
      chatId,
      content as string,
      {
        onChunk(chunk) {
          res.write(`data: ${JSON.stringify({ type: 'chunk', chunk })}\n\n`);
        },
        onDone(_fullContent, message) {
          res.write(`data: ${JSON.stringify({ type: 'done', message })}\n\n`);
          res.end();

          req.services.webhookService
            .notify('message.created', chatId, { message })
            .catch(() => {});
        },
        onError(err) {
          res.write(
            `data: ${JSON.stringify({ type: 'error', error: err.message })}\n\n`
          );
          res.end();
        },
      },
      opts
    );
  } else {
    try {
      const { userMessage, assistantMessage } =
        await req.services.chatService.sendMessage(chatId, content as string, opts);

      req.services.webhookService
        .notify('message.created', chatId, { message: assistantMessage })
        .catch(() => {});

      res.status(201).json({ userMessage, assistantMessage });
    } catch (err) {
      next(err);
    }
  }
});

export default router;
