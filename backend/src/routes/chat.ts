'use strict';

import { Router, Request, Response, NextFunction } from 'express';

const router = Router();

/** Return true if the authenticated user is allowed to access the chat. */
function canAccessChat(chat: Record<string, unknown>, userId: string, userRole: string): boolean {
  if (userRole === 'admin') return true;
  if (!chat.ownerId) return false; // Legacy chats without owner → admin-only
  return chat.ownerId === userId;
}

// POST /api/chats
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = { ...(req.body as Record<string, unknown>), ownerId: req.user!.id };
    const chat = await req.services.chatService.createChat(body);
    res.status(201).json(chat);
  } catch (err) {
    next(err);
  }
});

// GET /api/chats
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chats = await req.services.chatService.listChats();
    const filtered = chats.filter((c: any) =>
      canAccessChat(c, req.user!.id, req.user!.role)
    );
    res.json(filtered);
  } catch (err) {
    next(err);
  }
});

// GET /api/chats/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const chat = await req.services.chatService.getChat(req.params.id as string);
    if (!chat) return res.status(404).json({ error: 'Chat not found' });
    if (!canAccessChat(chat as Record<string, unknown>, req.user!.id, req.user!.role)) {
      return res.status(403).json({ error: 'You do not have access to this chat' });
    }
    res.json(chat);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/chats/:id
router.patch('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await req.services.chatService.getChat(req.params.id as string);
    if (!existing) return res.status(404).json({ error: 'Chat not found' });
    if (!canAccessChat(existing as Record<string, unknown>, req.user!.id, req.user!.role)) {
      return res.status(403).json({ error: 'You do not have access to this chat' });
    }
    const chat = await req.services.chatService.updateChat(req.params.id as string, req.body as Record<string, unknown>);
    res.json(chat);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/chats/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const existing = await req.services.chatService.getChat(req.params.id as string);
    if (!existing) return res.status(404).json({ error: 'Chat not found' });
    if (!canAccessChat(existing as Record<string, unknown>, req.user!.id, req.user!.role)) {
      return res.status(403).json({ error: 'You do not have access to this chat' });
    }
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

  // Verify ownership before allowing message creation
  try {
    const targetChat = await req.services.chatService.getChat(chatId);
    if (!targetChat) return res.status(404).json({ error: 'Chat not found' });
    if (!canAccessChat(targetChat as Record<string, unknown>, req.user!.id, req.user!.role)) {
      return res.status(403).json({ error: 'You do not have access to this chat' });
    }
  } catch (err) {
    return next(err);
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
