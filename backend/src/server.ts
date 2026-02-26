'use strict';

import http from 'http';
import { Server as SocketIOServer } from 'socket.io';
import app from './app';
import config from './config';
import ChatService from './services/ChatService';
import KnowledgeService from './services/KnowledgeService';
import WebhookService from './services/WebhookService';

const server = http.createServer(app);

// ── Socket.io (real-time streaming) ───────────────────────────────────────

const io = new SocketIOServer(server, {
  cors: {
    origin: config.cors.origins as string[],
    methods: ['GET', 'POST'],
    credentials: true,
  },
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
  console.log(`[WS] Client connected: ${socket.id}`);

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

    await chatService.streamMessage(
      chatId,
      content,
      {
        onChunk(chunk) {
          socket.emit('chat:chunk', { chatId, chunk });
        },
        onDone(_fullContent, message) {
          socket.emit('chat:done', { chatId, message });
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
    console.log(`[WS] Client disconnected: ${socket.id}`);
  });
});

// ── Start ──────────────────────────────────────────────────────────────────

server.listen(config.port, () => {
  console.log(`✅  DeltaChat backend running on port ${config.port} (${config.nodeEnv})`);
  console.log(`   Health:  http://localhost:${config.port}/health`);
  console.log(`   API:     http://localhost:${config.port}/api`);
});

process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received – shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received – shutting down');
  server.close(() => process.exit(0));
});

export { server, io };
