'use strict';

import { v4 as uuidv4 } from 'uuid';
import { getAdapter, DeltaDatabaseAdapter, Entity } from '../db/DeltaDatabaseAdapter';
import ModelProviderBase from '../modules/ModelProvider/ModelProviderBase';
import OpenAIProvider from '../modules/ModelProvider/OpenAIProvider';
import GeminiProvider from '../modules/ModelProvider/GeminiProvider';
import OllamaProvider from '../modules/ModelProvider/OllamaProvider';
import type KnowledgeService from './KnowledgeService';
import config from '../config';

interface AppError extends Error {
  status?: number;
}

interface ChatMessage {
  role: string;
  content: string;
}

interface StreamCallbacks {
  onChunk: (chunk: string) => void;
  onDone: (fullContent: string, message: Entity) => void;
  onError: (err: AppError) => void;
}

interface SendMessageOpts {
  model?: string;
  modelId?: string;
  temperature?: number;
  maxTokens?: number;
  provider?: string;
  stream?: boolean;
}

interface ChatServiceOpts {
  db?: DeltaDatabaseAdapter;
  getProvider?: () => ModelProviderBase;
  knowledgeService?: KnowledgeService | null;
}

interface ProviderSettings {
  enabled?: boolean;
  apiKey?: string;
  baseUrl?: string;
  defaultModel?: string;
}

/** Cache of provider instances keyed by provider name */
const _providerCache = new Map<string, ModelProviderBase>();

/**
 * Build a provider instance for the given provider name, using
 * saved settings from the database and falling back to env-var config.
 */
async function buildProvider(providerName: string, db: DeltaDatabaseAdapter): Promise<ModelProviderBase> {
  const cached = _providerCache.get(providerName);
  if (cached) return cached;

  // Load saved settings from the database
  const settings = await db.getSettings();
  const ps = (settings[providerName] ?? {}) as ProviderSettings;

  let provider: ModelProviderBase;

  switch (providerName) {
    case 'openai': {
      const apiKey = ps.apiKey || config.openai.apiKey;
      if (!apiKey) throw Object.assign(new Error('OpenAI API key not configured'), { status: 400 });
      provider = new OpenAIProvider({ apiKey, defaultModel: ps.defaultModel || config.openai.defaultModel });
      break;
    }
    case 'gemini': {
      const apiKey = ps.apiKey || config.gemini.apiKey;
      if (!apiKey) throw Object.assign(new Error('Gemini API key not configured'), { status: 400 });
      provider = new GeminiProvider({ apiKey, defaultModel: ps.defaultModel || config.gemini.defaultModel });
      break;
    }
    case 'ollama': {
      const baseUrl = ps.baseUrl || config.ollama.baseUrl;
      provider = new OllamaProvider({ baseUrl, defaultModel: ps.defaultModel || config.ollama.defaultModel });
      break;
    }
    default:
      throw Object.assign(new Error(`Unknown provider: ${providerName}`), { status: 400 });
  }

  _providerCache.set(providerName, provider);
  return provider;
}

/** Fallback: pick first available provider from env config */
function getDefaultProvider(): ModelProviderBase {
  if (config.openai.apiKey) return new OpenAIProvider();
  if (config.gemini.apiKey) return new GeminiProvider();
  // Default to Ollama (runs locally, no key needed)
  return new OllamaProvider();
}

/** Clear the provider cache — called when settings are saved */
export function clearProviderCache(): void {
  _providerCache.clear();
}

class ChatService {
  private _db: DeltaDatabaseAdapter;
  private _getProvider: () => ModelProviderBase;
  private _knowledgeService: KnowledgeService | null;

  constructor(opts: ChatServiceOpts = {}) {
    this._db = opts.db ?? getAdapter();
    this._getProvider = opts.getProvider ?? getDefaultProvider;
    this._knowledgeService = opts.knowledgeService ?? null;
  }

  setKnowledgeService(svc: KnowledgeService): void {
    this._knowledgeService = svc;
  }

  // ── Chat CRUD ──────────────────────────────────────────────────────────────

  async createChat(data: Record<string, unknown> = {}): Promise<Entity> {
    return this._db.createChat({
      id: uuidv4(),
      title: (data['title'] as string | undefined) ?? (data['name'] as string | undefined) ?? 'New Chat',
      model: (data['model'] as string | null | undefined) ?? null,
      modelId: (data['modelId'] as string | null | undefined) ?? null,
      folder: (data['folder'] as string | null | undefined) ?? null,
      bookmarked: (data['bookmarked'] as boolean | undefined) ?? false,
      systemPrompt: (data['systemPrompt'] as string | null | undefined) ?? null,
      knowledgeStoreIds: (data['knowledgeStoreIds'] as string[] | undefined) ?? [],
      webhookId: (data['webhookId'] as string | null | undefined) ?? null,
      metadata: (data['metadata'] as Record<string, unknown> | undefined) ?? {},
    });
  }

  async listChats(): Promise<Entity[]> {
    const chats = await this._db.listChats();
    return chats.sort((a, b) => new Date(b.updatedAt ?? '').getTime() - new Date(a.updatedAt ?? '').getTime());
  }

  async getChat(id: string): Promise<Entity & { messages: Entity[] }> {
    const chat = await this._db.getChat(id);
    if (!chat) {
      const err: AppError = new Error(`Chat not found: ${id}`);
      err.status = 404;
      throw err;
    }
    const messages = await this._db.listMessages(id);
    messages.sort((a, b) => new Date(a.createdAt ?? '').getTime() - new Date(b.createdAt ?? '').getTime());
    return { ...chat, messages };
  }

  async updateChat(id: string, fields: Record<string, unknown>): Promise<Entity | null> {
    await this._assertExists(id);
    return this._db.updateChat(id, fields);
  }

  async deleteChat(id: string): Promise<unknown> {
    await this._assertExists(id);
    await this._db.deleteMessagesByChatId(id);
    return this._db.deleteChat(id);
  }

  // ── Messaging ──────────────────────────────────────────────────────────────

  async sendMessage(chatId: string, userContent: string, opts: SendMessageOpts = {}): Promise<{ userMessage: Entity; assistantMessage: Entity }> {
    const chat = await this.getChat(chatId);

    const userMessage = await this._db.createMessage({
      id: uuidv4(),
      chatId,
      role: 'user',
      content: userContent,
    });

    const resolved = await this._resolveModelConfig(opts, chat);
    const messages = await this._buildMessages(chat, userContent, resolved.systemPromptOverride, resolved.knowledgeStoreIdsOverride);

    const provider = await this._resolveProvider(opts, chat);
    const result = await provider.chat(messages, resolved.modelOpts);

    const assistantMessage = await this._db.createMessage({
      id: uuidv4(),
      chatId,
      role: 'assistant',
      content: result.content,
      model: result.model,
      usage: result.usage,
    });

    if (chat.messages.length === 0 && !(chat['title'] as string | undefined)?.trim()) {
      const title = userContent.slice(0, 60);
      await this._db.updateChat(chatId, { title });
    }

    return { userMessage, assistantMessage };
  }

  async streamMessage(
    chatId: string,
    userContent: string,
    { onChunk, onDone, onError }: StreamCallbacks,
    opts: SendMessageOpts = {}
  ): Promise<void> {
    let chat: Entity & { messages: Entity[] };
    try {
      chat = await this.getChat(chatId);
    } catch (err) {
      return onError(err as AppError);
    }

    await this._db.createMessage({
      id: uuidv4(),
      chatId,
      role: 'user',
      content: userContent,
    });

    const resolved = await this._resolveModelConfig(opts, chat);
    const messages = await this._buildMessages(chat, userContent, resolved.systemPromptOverride, resolved.knowledgeStoreIdsOverride);
    const provider = await this._resolveProvider(opts, chat);

    let full = '';
    try {
      for await (const chunk of provider.stream(messages, resolved.modelOpts)) {
        full += chunk;
        onChunk(chunk);
      }

      const assistantMessage = await this._db.createMessage({
        id: uuidv4(),
        chatId,
        role: 'assistant',
        content: full,
        model: (resolved.modelOpts['model'] ?? opts.model ?? chat['model'] ?? null) as string | null,
      });

      onDone(full, assistantMessage);
    } catch (err) {
      onError(err as AppError);
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async _buildMessages(
    chat: Entity & { messages: Entity[] },
    newUserContent: string,
    systemPromptOverride?: string,
    knowledgeStoreIdsOverride?: string[]
  ): Promise<ChatMessage[]> {
    const history: ChatMessage[] = (chat.messages ?? []).map((m) => ({
      role: m['role'] as string,
      content: m['content'] as string,
    }));

    const knowledgeStoreIds = knowledgeStoreIdsOverride
      ?? (Array.isArray(chat['knowledgeStoreIds']) ? (chat['knowledgeStoreIds'] as string[]) : []);

    let ragContext = '';
    if (this._knowledgeService && knowledgeStoreIds.length > 0) {
      try {
        const results = await this._knowledgeService.retrieve(
          newUserContent,
          knowledgeStoreIds,
          { topK: 5 }
        );
        if (results.length > 0) {
          ragContext =
            '\n\n---\nRelevant context from knowledge base:\n' +
            results.map((r, i) => `[${i + 1}] ${r.text}`).join('\n\n');
        }
      } catch (err) {
        console.error('[ChatService] RAG retrieval failed:', (err as Error).message);
      }
    }

    const messages: ChatMessage[] = [];

    const systemPrompt =
      systemPromptOverride ??
      (chat['systemPrompt'] as string | null | undefined) ??
      'You are a helpful AI assistant.';
    messages.push({ role: 'system', content: systemPrompt + ragContext });

    messages.push(...history);

    messages.push({ role: 'user', content: newUserContent });

    return messages;
  }

  private async _resolveProvider(opts: SendMessageOpts, chat?: Entity): Promise<ModelProviderBase> {
    // 1. Explicit provider from opts
    const providerName = opts.provider
      ?? (chat?.['provider'] as string | undefined);

    if (providerName) {
      try {
        return await buildProvider(providerName, this._db);
      } catch (err) {
        console.error(`[ChatService] Failed to build provider "${providerName}":`, (err as Error).message);
      }
    }

    // 2. Resolve from modelId → aiModel.provider
    const modelId = opts.modelId ?? (chat?.['modelId'] as string | undefined);
    if (modelId) {
      try {
        const aiModel = await this._db.getAiModel(modelId);
        if (aiModel?.['provider']) {
          return await buildProvider(aiModel['provider'] as string, this._db);
        }
      } catch {
        // fall through to default
      }
    }

    // 3. Fallback to default provider
    try {
      return this._getProvider();
    } catch {
      return getDefaultProvider();
    }
  }

  private _buildModelOpts(chat: Entity, opts: SendMessageOpts): Record<string, unknown> {
    return {
      model: opts.model ?? chat['model'] ?? undefined,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
    };
  }

  private async _resolveModelConfig(opts: SendMessageOpts, chat: Entity): Promise<{
    systemPromptOverride?: string;
    knowledgeStoreIdsOverride?: string[];
    modelOpts: Record<string, unknown>;
  }> {
    const modelId = opts.modelId ?? (chat['modelId'] as string | undefined);
    if (!modelId) {
      return { modelOpts: this._buildModelOpts(chat, opts) };
    }
    try {
      const aiModel = await this._db.getAiModel(modelId);
      if (!aiModel) return { modelOpts: this._buildModelOpts(chat, opts) };

      // If model points to an agent, load the agent config
      if (aiModel['type'] === 'agent' && aiModel['agentId']) {
        const agent = await this._db.getAgent(aiModel['agentId'] as string);
        if (agent) {
          return {
            systemPromptOverride: agent['systemPrompt'] as string,
            knowledgeStoreIdsOverride: (agent['knowledgeStoreIds'] as string[]) ?? [],
            modelOpts: {
              model: (agent['providerModel'] as string) ?? opts.model ?? chat['model'] ?? undefined,
              temperature: (agent['temperature'] as number | null) ?? opts.temperature,
              maxTokens: (agent['maxTokens'] as number | null) ?? opts.maxTokens,
            },
          };
        }
      }

      return {
        systemPromptOverride: (aiModel['systemPrompt'] as string | null) ?? undefined,
        knowledgeStoreIdsOverride: (aiModel['knowledgeStoreIds'] as string[]) ?? undefined,
        modelOpts: {
          model: (aiModel['providerModel'] as string) ?? opts.model ?? chat['model'] ?? undefined,
          temperature: (aiModel['temperature'] as number | null) ?? opts.temperature,
          maxTokens: (aiModel['maxTokens'] as number | null) ?? opts.maxTokens,
        },
      };
    } catch {
      return { modelOpts: this._buildModelOpts(chat, opts) };
    }
  }

  private async _assertExists(id: string): Promise<Entity> {
    const chat = await this._db.getChat(id);
    if (!chat) {
      const err: AppError = new Error(`Chat not found: ${id}`);
      err.status = 404;
      throw err;
    }
    return chat;
  }
}

export default ChatService;
