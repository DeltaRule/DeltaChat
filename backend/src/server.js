'use strict';

const http = require('http');
const { Server: SocketIOServer } = require('socket.io');
const app = require('./app');
const config = require('./config');

const server = http.createServer(app);

// ── Socket.io (real-time streaming) ───────────────────────────────────────

const io = new SocketIOServer(server, {
  cors: {
    origin: config.cors.origins,
    methods: ['GET', 'POST'],
    credentials: true,
  },
});

/**
 * WebSocket chat streaming protocol:
 *
 * Client → Server:
 *   event: "chat:send"
 *   data:  { chatId, content, model?, temperature?, stream?: true }
 *
 * Server → Client:
 *   event: "chat:chunk"   data: { chatId, chunk }
 *   event: "chat:done"    data: { chatId, message }
 *   event: "chat:error"   data: { chatId, error }
 */
io.on('connection', (socket) => {
  console.log(`[WS] Client connected: ${socket.id}`);

  socket.on('chat:send', async (data = {}) => {
    const { chatId, content, ...opts } = data;

    if (!chatId || !content) {
      return socket.emit('chat:error', {
        chatId,
        error: 'chatId and content are required',
      });
    }

    // Lazy-load services to avoid circular deps at module level
    const ChatService = require('./services/ChatService');
    const KnowledgeService = require('./services/KnowledgeService');
    const WebhookService = require('./services/WebhookService');

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
        onDone(fullContent, message) {
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

server.listen(config.port, async () => {
  console.log(`✅  DeltaChat backend running on port ${config.port} (${config.nodeEnv})`);
  console.log(`   Health:  http://localhost:${config.port}/health`);
  console.log(`   API:     http://localhost:${config.port}/api`);

  // Register JSON Schemas in DeltaDatabase for all collections
  try {
    const { getAdapter } = require('./db/DeltaDatabaseAdapter');
    await getAdapter().initialize();
  } catch (err) {
    console.error('[Server] Failed to initialize DeltaDatabase schemas:', err.message);
  }
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('[Server] SIGTERM received – shutting down gracefully');
  server.close(() => process.exit(0));
});

process.on('SIGINT', () => {
  console.log('[Server] SIGINT received – shutting down');
  server.close(() => process.exit(0));
});

module.exports = { server, io };
