'use strict';

require('dotenv').config();

module.exports = {
  port: parseInt(process.env.PORT, 10) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',

  deltaDb: {
    // Base URL of the DeltaDatabase REST service.
    // Leave empty to use the local FileSystemFallback (dev shim).
    url: process.env.DELTA_DB_URL || null,
    // Admin key configured on the DeltaDatabase server (-e ADMIN_KEY=…).
    adminKey: process.env.DELTA_DB_ADMIN_KEY || null,
    // Named database (namespace) inside DeltaDatabase.
    database: process.env.DELTA_DB_DATABASE || 'deltachat',
    // Used by FileSystemFallback only.
    dataDir: process.env.DELTA_DB_DATA_DIR || './data',
  },

  openai: {
    apiKey: process.env.OPENAI_API_KEY || '',
    defaultModel: process.env.OPENAI_DEFAULT_MODEL || 'gpt-4o',
  },

  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    defaultModel: process.env.GEMINI_DEFAULT_MODEL || 'gemini-pro',
  },

  ollama: {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
    defaultModel: process.env.OLLAMA_DEFAULT_MODEL || 'llama3',
  },

  chroma: {
    url: process.env.CHROMA_URL || 'http://localhost:8000',
    defaultCollection: process.env.CHROMA_DEFAULT_COLLECTION || 'deltachat',
  },

  tika: {
    url: process.env.TIKA_URL || 'http://localhost:9998',
  },

  docling: {
    url: process.env.DOCLING_URL || 'http://localhost:5001',
  },

  binaryStorage: {
    path: process.env.BINARY_STORAGE_PATH || './data/binaries',
  },

  mcp: {
    serverUrl: process.env.MCP_SERVER_URL || '',
  },

  webhookSecret: process.env.WEBHOOK_SECRET || 'change-me-in-production',

  cors: {
    origins: (process.env.CORS_ORIGINS || 'http://localhost:3000,http://localhost:5173')
      .split(',')
      .map((o) => o.trim()),
  },
};
