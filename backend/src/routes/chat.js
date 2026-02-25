'use strict';

const { Router } = require('express');

const router = Router();

// POST /api/chats
router.post('/', async (req, res, next) => {
  try {
    const chat = await req.services.chatService.createChat(req.body);
    res.status(201).json(chat);
  } catch (err) {
    next(err);
  }
});

// GET /api/chats
router.get('/', async (req, res, next) => {
  try {
    const chats = await req.services.chatService.listChats();
    res.json(chats);
  } catch (err) {
    next(err);
  }
});

// GET /api/chats/:id
router.get('/:id', async (req, res, next) => {
  try {
    const chat = await req.services.chatService.getChat(req.params.id);
    res.json(chat);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/chats/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const chat = await req.services.chatService.updateChat(req.params.id, req.body);
    res.json(chat);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/chats/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await req.services.chatService.deleteChat(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/chats/:id/messages
// Supports both regular JSON and SSE streaming (Accept: text/event-stream)
router.post('/:id/messages', async (req, res, next) => {
  const { content, stream: streamRequested, ...opts } = req.body;

  if (!content) {
    return res.status(400).json({ error: 'content is required' });
  }

  const wantsStream =
    streamRequested === true || req.headers.accept === 'text/event-stream';

  if (wantsStream) {
    // SSE streaming response
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    await req.services.chatService.streamMessage(
      req.params.id,
      content,
      {
        onChunk(chunk) {
          res.write(`data: ${JSON.stringify({ type: 'chunk', chunk })}\n\n`);
        },
        onDone(fullContent, message) {
          res.write(`data: ${JSON.stringify({ type: 'done', message })}\n\n`);
          res.end();

          // Notify webhooks (fire and forget)
          req.services.webhookService
            .notify('message.created', req.params.id, { message })
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
    // Standard JSON response
    try {
      const { userMessage, assistantMessage } =
        await req.services.chatService.sendMessage(req.params.id, content, opts);

      // Notify webhooks (fire and forget)
      req.services.webhookService
        .notify('message.created', req.params.id, { message: assistantMessage })
        .catch(() => {});

      res.status(201).json({ userMessage, assistantMessage });
    } catch (err) {
      next(err);
    }
  }
});

module.exports = router;
