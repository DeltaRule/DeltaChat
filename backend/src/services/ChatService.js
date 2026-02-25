'use strict';

const { v4: uuidv4 } = require('uuid');
const { getAdapter } = require('../db/DeltaDatabaseAdapter');

// Default providers (lazy-loaded so they are only instantiated when used)
let _modelProvider = null;

function getModelProvider() {
  if (_modelProvider) return _modelProvider;
  const config = require('../config');
  if (config.openai.apiKey) {
    const OpenAIProvider = require('../modules/ModelProvider/OpenAIProvider');
    _modelProvider = new OpenAIProvider();
  } else if (config.gemini.apiKey) {
    const GeminiProvider = require('../modules/ModelProvider/GeminiProvider');
    _modelProvider = new GeminiProvider();
  } else {
    throw new Error(
      'No model provider configured. Set OPENAI_API_KEY or GEMINI_API_KEY in .env'
    );
  }
  return _modelProvider;
}

/**
 * ChatService
 *
 * Manages conversations.  Supports:
 *  - Creating / listing / deleting chats
 *  - Sending messages (non-streaming and SSE streaming)
 *  - RAG: querying attached knowledge stores before calling the model
 *  - Persisting every message to DeltaDatabase
 */
class ChatService {
  constructor(opts = {}) {
    this._db = opts.db || getAdapter();
    this._getProvider = opts.getProvider || getModelProvider;
    this._knowledgeService = opts.knowledgeService || null; // injected later to avoid circular deps
  }

  // Allow KnowledgeService to be injected after construction
  setKnowledgeService(svc) {
    this._knowledgeService = svc;
  }

  // ── Chat CRUD ──────────────────────────────────────────────────────────────

  async createChat(data = {}) {
    return this._db.createChat({
      id: uuidv4(),
      title: data.title || 'New Chat',
      model: data.model || null,
      systemPrompt: data.systemPrompt || null,
      knowledgeStoreIds: data.knowledgeStoreIds || [],
      webhookId: data.webhookId || null,
      metadata: data.metadata || {},
    });
  }

  async listChats() {
    const chats = await this._db.listChats();
    return chats.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  }

  async getChat(id) {
    const chat = await this._db.getChat(id);
    if (!chat) {
      const err = new Error(`Chat not found: ${id}`);
      err.status = 404;
      throw err;
    }
    const messages = await this._db.listMessages(id);
    messages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt));
    return { ...chat, messages };
  }

  async updateChat(id, fields) {
    await this._assertExists(id);
    return this._db.updateChat(id, fields);
  }

  async deleteChat(id) {
    await this._assertExists(id);
    await this._db.deleteMessagesByChatId(id);
    return this._db.deleteChat(id);
  }

  // ── Messaging ──────────────────────────────────────────────────────────────

  /**
   * Send a message and return the full assistant reply (non-streaming).
   * @param {string} chatId
   * @param {string} userContent - The user's message text.
   * @param {object} [opts]
   * @param {string} [opts.model]       - Override model for this request.
   * @param {number} [opts.temperature]
   * @param {string} [opts.provider]    - Provider name ('openai','gemini',…)
   * @returns {Promise<{ userMessage, assistantMessage }>}
   */
  async sendMessage(chatId, userContent, opts = {}) {
    const chat = await this.getChat(chatId);

    // Persist user message
    const userMessage = await this._db.createMessage({
      id: uuidv4(),
      chatId,
      role: 'user',
      content: userContent,
    });

    // Build context
    const messages = await this._buildMessages(chat, userContent);

    // Call model
    const provider = this._resolveProvider(chat, opts);
    const modelOpts = this._buildModelOpts(chat, opts);
    const result = await provider.chat(messages, modelOpts);

    // Persist assistant reply
    const assistantMessage = await this._db.createMessage({
      id: uuidv4(),
      chatId,
      role: 'assistant',
      content: result.content,
      model: result.model,
      usage: result.usage,
    });

    // Update chat title on first exchange
    if (chat.messages.length === 0 && !chat.title?.trim()) {
      const title = userContent.slice(0, 60);
      await this._db.updateChat(chatId, { title });
    }

    return { userMessage, assistantMessage };
  }

  /**
   * Stream an assistant response.  Calls `onChunk(chunk)` for each text
   * delta, then `onDone(fullContent)` when complete.
   */
  async streamMessage(chatId, userContent, { onChunk, onDone, onError }, opts = {}) {
    let chat;
    try {
      chat = await this.getChat(chatId);
    } catch (err) {
      return onError(err);
    }

    // Persist user message
    const userMessage = await this._db.createMessage({
      id: uuidv4(),
      chatId,
      role: 'user',
      content: userContent,
    });

    const messages = await this._buildMessages(chat, userContent);
    const provider = this._resolveProvider(chat, opts);
    const modelOpts = this._buildModelOpts(chat, opts);

    let full = '';
    try {
      for await (const chunk of provider.stream(messages, modelOpts)) {
        full += chunk;
        onChunk(chunk);
      }

      const assistantMessage = await this._db.createMessage({
        id: uuidv4(),
        chatId,
        role: 'assistant',
        content: full,
        model: opts.model || chat.model || null,
      });

      onDone(full, assistantMessage);
    } catch (err) {
      onError(err);
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  async _buildMessages(chat, newUserContent) {
    const history = (chat.messages || []).map((m) => ({
      role: m.role,
      content: m.content,
    }));

    // RAG: retrieve relevant context from attached knowledge stores
    let ragContext = '';
    if (
      this._knowledgeService &&
      Array.isArray(chat.knowledgeStoreIds) &&
      chat.knowledgeStoreIds.length > 0
    ) {
      try {
        const results = await this._knowledgeService.retrieve(
          newUserContent,
          chat.knowledgeStoreIds,
          { topK: 5 }
        );
        if (results.length > 0) {
          ragContext =
            '\n\n---\nRelevant context from knowledge base:\n' +
            results.map((r, i) => `[${i + 1}] ${r.text}`).join('\n\n');
        }
      } catch (err) {
        console.error('[ChatService] RAG retrieval failed:', err.message);
      }
    }

    const messages = [];

    // System prompt
    const systemPrompt = chat.systemPrompt || 'You are a helpful AI assistant.';
    messages.push({ role: 'system', content: systemPrompt + ragContext });

    // History (exclude the message we're about to add)
    messages.push(...history);

    // New user message
    messages.push({ role: 'user', content: newUserContent });

    return messages;
  }

  _resolveProvider(chat, opts) {
    // In the future opts.provider or chat.providerName could select a provider
    return this._getProvider();
  }

  _buildModelOpts(chat, opts) {
    return {
      model: opts.model || chat.model || undefined,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
    };
  }

  async _assertExists(id) {
    const chat = await this._db.getChat(id);
    if (!chat) {
      const err = new Error(`Chat not found: ${id}`);
      err.status = 404;
      throw err;
    }
    return chat;
  }
}

module.exports = ChatService;
