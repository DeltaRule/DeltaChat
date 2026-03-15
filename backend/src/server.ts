'use strict';

import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import config from './config';
import logger from './logger';
import ChatService from './services/ChatService';
import KnowledgeService from './services/KnowledgeService';
import WebhookService from './services/WebhookService';
import { getAuthService } from './services/AuthService';

const server = http.createServer(app);

// ── Socket.io (real-time streaming) ───────────────────────────────────────

const io = new SocketIOServer(server, {
  cors: {
    origin: config.cors.origins as string[],
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

// Authenticate Socket.IO connections via JWT
io.use((socket, next) => {
  const token = socket.handshake.auth?.token as string | undefined;
  if (!token) {
    return next(new Error('Authentication required'));
  }
  try {
    const authService = getAuthService();
    const user = authService.verifyToken(token);
    (socket as any).user = user;
    next();
  } catch {
    next(new Error('Invalid or expired token'));
  }
});

interface ChatSendData {
  chatId?: string;
  content?: string;
  model?: string;
  temperature?: number;
  stream?: boolean;
  [key: string]: unknown;
}

io.on('connection', (socket) => {
  logger.debug(`[WS] Client connected: ${socket.id}`);

  socket.on('chat:send', async (data: ChatSendData = {}) => {
    const { chatId, content, ...opts } = data;

    if (!chatId || !content) {
      return socket.emit('chat:error', {
        chatId,
        error: 'chatId and content are required',
      });
    }

    const knowledgeService = new KnowledgeService();
    const chatService = new ChatService();
    chatService.setKnowledgeService(knowledgeService);
    const webhookService = new WebhookService();

    // Verify ownership before streaming
    const socketUser = (socket as any).user;
    if (socketUser) {
      try {
        const targetChat = await chatService.getChat(chatId);
        if (targetChat) {
          const ownerId = (targetChat as any).ownerId;
          if (ownerId && ownerId !== socketUser.id && socketUser.role !== 'admin') {
            return socket.emit('chat:error', { chatId, error: 'You do not have access to this chat' });
          }
        }
      } catch {
        // If chat lookup fails, let streamMessage handle the error
      }
    }

    await chatService.streamMessage(
      chatId,
      content,
      {
        onChunk(chunk) {
          socket.emit('chat:chunk', { chatId, chunk });
        },
        onDone(_fullContent, message, sources) {
          socket.emit('chat:done', { chatId, message, sources });
          webhookService
            .notify('message.created', chatId, { message })
            .catch(() => {});
        },
        onError(err) {
          socket.emit('chat:error', { chatId, error: err.message });
        },
      },
      opts
    );
  });

  socket.on('disconnect', () => {
    logger.debug(`[WS] Client disconnected: ${socket.id}`);
  });
});

import { getAdapter } from './db/DeltaDatabaseAdapter';

// ── Start ──────────────────────────────────────────────────────────────────

(async () => {
  try {
    const adapter = getAdapter();
    await adapter._backend.initSchemas();
    logger.info('[DeltaDB] All schemas registered successfully');

    // ── Migrate legacy data: assign orphaned entities to first admin ──
    try {
      const users = await adapter.listUsers();
      const firstAdmin = users.find((u) => u['role'] === 'admin');
      if (firstAdmin) {
        const collections: Array<{ name: string; list: () => Promise<any[]>; update: (id: string, data: any) => Promise<any> }> = [
          { name: 'chats', list: () => adapter.listChats(), update: (id, d) => adapter.updateChat(id, d) },
          { name: 'ai_models', list: () => adapter.listAiModels(), update: (id, d) => adapter.updateAiModel(id, d) },
          { name: 'agents', list: () => adapter.listAgents(), update: (id, d) => adapter.updateAgent(id, d) },
          { name: 'tools', list: () => adapter.listTools(), update: (id, d) => adapter.updateTool(id, d) },
          { name: 'knowledge_stores', list: () => adapter.listKnowledgeStores(), update: (id, d) => adapter.updateKnowledgeStore(id, d) },
        ];
        for (const col of collections) {
          const items = await col.list();
          let migrated = 0;
          for (const item of items) {
            if (!item['ownerId']) {
              await col.update(item.id, { ownerId: firstAdmin.id });
              migrated++;
            }
          }
          if (migrated > 0) {
            logger.info(`[Migration] Assigned ${migrated} orphaned ${col.name} to admin ${firstAdmin['email']}`);
          }
        }
      }
    } catch (err) {
      logger.warn('[Migration] Legacy data migration failed (non-fatal):', err);
    }
  } catch (err) {
    logger.error('[DeltaDB] Failed to register schemas:', err);
    process.exit(1);
  }

  server.listen(config.port, () => {
    logger.info(`✅  DeltaChat backend running on port ${config.port} (${config.nodeEnv})`);
    logger.info(`   Health:  http://localhost:${config.port}/health`);
    logger.info(`   API:     http://localhost:${config.port}/api`);
  });
})();

process.on('SIGTERM', () => {
  logger.info('[Server] SIGTERM received – shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  logger.info('[Server] SIGINT received – shutting down');
  server.close(() => process.exit(0));
});

export { server, io };
