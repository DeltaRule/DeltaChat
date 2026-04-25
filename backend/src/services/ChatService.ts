'use strict'

import { randomUUID } from 'crypto'
import { getAdapter, DeltaDatabaseAdapter, Entity } from '../db/DeltaDatabaseAdapter'
import ModelProviderBase, {
  ChatMessage as ModelChatMessage,
  ChatResult,
  ToolCall,
  ToolDefinition,
} from '../modules/ModelProvider/ModelProviderBase'
import OpenAIProvider from '../modules/ModelProvider/OpenAIProvider'
import GeminiProvider from '../modules/ModelProvider/GeminiProvider'
import OllamaProvider from '../modules/ModelProvider/OllamaProvider'
import AnthropicProvider from '../modules/ModelProvider/AnthropicProvider'
import GroqProvider from '../modules/ModelProvider/GroqProvider'
import AzureOpenAIProvider from '../modules/ModelProvider/AzureOpenAIProvider'
import MistralProvider from '../modules/ModelProvider/MistralProvider'
import DeepSeekProvider from '../modules/ModelProvider/DeepSeekProvider'
import CohereProvider from '../modules/ModelProvider/CohereProvider'
import WebhookProvider from '../modules/ModelProvider/WebhookProvider'
import type KnowledgeService from './KnowledgeService'
import type ToolExecutionService from './ToolExecutionService'
import config from '../config'
import logger from '../logger'

interface AppError extends Error {
  status?: number
}

interface StreamCallbacks {
  onChunk: (chunk: string) => void
  onDone: (fullContent: string, message: Entity, sources?: RagSource[]) => void
  onError: (err: AppError) => void
}

interface RagSource {
  docId: string
  storeId: string
  text: string
  score: number
  chunkId: string
  filename?: string
}

interface SendMessageOpts {
  model?: string
  modelId?: string
  temperature?: number
  maxTokens?: number
  provider?: string
  stream?: boolean
}

interface ChatServiceOpts {
  db?: DeltaDatabaseAdapter
  getProvider?: () => ModelProviderBase
  knowledgeService?: KnowledgeService | null
  toolExecutionService?: ToolExecutionService | null
}

interface ProviderSettings {
  enabled?: boolean
  apiKey?: string
  baseUrl?: string
  defaultModel?: string
  apiVersion?: string
}

interface ResolvedModelConfig {
  systemPromptOverride?: string
  knowledgeStoreIdsOverride?: string[]
  modelOpts: Record<string, unknown>
  toolIds: string[]
  providerOverride?: string
}

interface ToolEntity {
  id: string
  name: string
  description?: string | null
  type: 'mcp' | 'python' | 'typescript'
  config: Record<string, unknown>
  enabled?: boolean
}

interface ToolCallEntry {
  id: string
  name: string
  arguments: Record<string, unknown>
  result: string
  error?: string
}

interface ToolRunResult {
  content: string
  model?: string
  usage?: Record<string, unknown>
  finishReason?: string
  toolCallLog: ToolCallEntry[]
}

/** Cache of provider instances keyed by provider name */
const _providerCache = new Map<string, ModelProviderBase>()

/**
 * Build a provider instance for the given provider name, using
 * saved settings from the database and falling back to env-var config.
 */
async function buildProvider(
  providerName: string,
  db: DeltaDatabaseAdapter,
): Promise<ModelProviderBase> {
  const cached = _providerCache.get(providerName)
  if (cached) return cached

  // Load saved settings from the database
  const settings = await db.getSettings()
  const ps = (settings[providerName] ?? {}) as ProviderSettings

  let provider: ModelProviderBase

  switch (providerName) {
    case 'openai': {
      const apiKey = ps.apiKey || config.openai.apiKey
      if (!apiKey) throw Object.assign(new Error('OpenAI API key not configured'), { status: 400 })
      provider = new OpenAIProvider({
        apiKey,
        defaultModel: ps.defaultModel || config.openai.defaultModel,
      })
      break
    }
    case 'gemini': {
      const apiKey = ps.apiKey || config.gemini.apiKey
      if (!apiKey) throw Object.assign(new Error('Gemini API key not configured'), { status: 400 })
      provider = new GeminiProvider({
        apiKey,
        defaultModel: ps.defaultModel || config.gemini.defaultModel,
      })
      break
    }
    case 'ollama': {
      const baseUrl = ps.baseUrl || config.ollama.baseUrl
      provider = new OllamaProvider({
        baseUrl,
        defaultModel: ps.defaultModel || config.ollama.defaultModel,
      })
      break
    }
    case 'anthropic': {
      const apiKey = ps.apiKey || config.anthropic.apiKey
      if (!apiKey)
        throw Object.assign(new Error('Anthropic API key not configured'), { status: 400 })
      provider = new AnthropicProvider({
        apiKey,
        defaultModel: ps.defaultModel || config.anthropic.defaultModel,
      })
      break
    }
    case 'groq': {
      const apiKey = ps.apiKey || config.groq.apiKey
      if (!apiKey) throw Object.assign(new Error('Groq API key not configured'), { status: 400 })
      provider = new GroqProvider({
        apiKey,
        defaultModel: ps.defaultModel || config.groq.defaultModel,
      })
      break
    }
    case 'azure': {
      const apiKey = ps.apiKey || config.azureOpenai.apiKey
      const endpointRaw = ps.baseUrl || config.azureOpenai.endpoint
      let endpoint = String(endpointRaw || '')
        .trim()
        .replace(/\/+$/, '')
      endpoint = endpoint.replace(/\/openai(?:\/.*)?$/i, '')
      if (!apiKey || !endpoint)
        throw Object.assign(new Error('Azure OpenAI API key or endpoint not configured'), {
          status: 400,
        })
      provider = new AzureOpenAIProvider({
        apiKey,
        endpoint,
        apiVersion: ps.apiVersion || config.azureOpenai.apiVersion,
        defaultModel: ps.defaultModel || config.azureOpenai.defaultModel,
      })
      break
    }
    case 'mistral': {
      const apiKey = ps.apiKey || config.mistral.apiKey
      if (!apiKey) throw Object.assign(new Error('Mistral API key not configured'), { status: 400 })
      provider = new MistralProvider({
        apiKey,
        defaultModel: ps.defaultModel || config.mistral.defaultModel,
      })
      break
    }
    case 'deepseek': {
      const apiKey = ps.apiKey || config.deepseek.apiKey
      if (!apiKey)
        throw Object.assign(new Error('DeepSeek API key not configured'), { status: 400 })
      provider = new DeepSeekProvider({
        apiKey,
        defaultModel: ps.defaultModel || config.deepseek.defaultModel,
      })
      break
    }
    case 'cohere': {
      const apiKey = ps.apiKey || config.cohere.apiKey
      if (!apiKey) throw Object.assign(new Error('Cohere API key not configured'), { status: 400 })
      provider = new CohereProvider({
        apiKey,
        defaultModel: ps.defaultModel || config.cohere.defaultModel,
      })
      break
    }
    default:
      throw Object.assign(new Error(`Unknown provider: ${providerName}`), { status: 400 })
  }

  _providerCache.set(providerName, provider)
  return provider
}

/** Fallback: pick first available provider from env config */
function getDefaultProvider(): ModelProviderBase {
  if (config.openai.apiKey) return new OpenAIProvider()
  if (config.gemini.apiKey) return new GeminiProvider()
  // Default to Ollama (runs locally, no key needed)
  return new OllamaProvider()
}

/** Clear the provider cache — called when settings are saved */
export function clearProviderCache(): void {
  _providerCache.clear()
}

class ChatService {
  private _db: DeltaDatabaseAdapter
  private _getProvider: () => ModelProviderBase
  private _knowledgeService: KnowledgeService | null
  private _toolExecutionService: ToolExecutionService | null

  constructor(opts: ChatServiceOpts = {}) {
    this._db = opts.db ?? getAdapter()
    this._getProvider = opts.getProvider ?? getDefaultProvider
    this._knowledgeService = opts.knowledgeService ?? null
    this._toolExecutionService = opts.toolExecutionService ?? null
  }

  setKnowledgeService(svc: KnowledgeService): void {
    this._knowledgeService = svc
  }

  setToolExecutionService(svc: ToolExecutionService): void {
    this._toolExecutionService = svc
  }

  // ── Chat CRUD ──────────────────────────────────────────────────────────────

  async createChat(data: Record<string, unknown> = {}): Promise<Entity> {
    return this._db.createChat({
      id: randomUUID(),
      title:
        (data['title'] as string | undefined) ?? (data['name'] as string | undefined) ?? 'New Chat',
      model: (data['model'] as string | null | undefined) ?? null,
      modelId: (data['modelId'] as string | null | undefined) ?? null,
      folder: (data['folder'] as string | null | undefined) ?? null,
      bookmarked: (data['bookmarked'] as boolean | undefined) ?? false,
      systemPrompt: (data['systemPrompt'] as string | null | undefined) ?? null,
      knowledgeStoreIds: (data['knowledgeStoreIds'] as string[] | undefined) ?? [],
      webhookId: (data['webhookId'] as string | null | undefined) ?? null,
      ownerId: (data['ownerId'] as string | null | undefined) ?? null,
      metadata: (data['metadata'] as Record<string, unknown> | undefined) ?? {},
    })
  }

  async listChats(): Promise<Entity[]> {
    const chats = await this._db.listChats()
    return chats.sort(
      (a, b) => new Date(b.updatedAt ?? '').getTime() - new Date(a.updatedAt ?? '').getTime(),
    )
  }

  async getChat(id: string): Promise<Entity & { messages: Entity[] }> {
    const chat = await this._db.getChat(id)
    if (!chat) {
      const err: AppError = new Error(`Chat not found: ${id}`)
      err.status = 404
      throw err
    }
    const messages = await this._db.listMessages(id)
    messages.sort(
      (a, b) => new Date(a.createdAt ?? '').getTime() - new Date(b.createdAt ?? '').getTime(),
    )
    return { ...chat, messages }
  }

  async updateChat(id: string, fields: Record<string, unknown>): Promise<Entity | null> {
    await this._assertExists(id)
    return this._db.updateChat(id, fields)
  }

  async deleteChat(id: string): Promise<unknown> {
    await this._assertExists(id)
    await this._db.deleteMessagesByChatId(id)
    return this._db.deleteChat(id)
  }

  // ── Messaging ──────────────────────────────────────────────────────────────

  async sendMessage(
    chatId: string,
    userContent: string,
    opts: SendMessageOpts = {},
  ): Promise<{ userMessage: Entity; assistantMessage: Entity }> {
    const chat = await this.getChat(chatId)

    const userMessage = await this._db.createMessage({
      id: randomUUID(),
      chatId,
      role: 'user',
      content: userContent,
    })

    const resolved = await this._resolveModelConfig(opts, chat)
    const { messages, sources } = await this._buildMessages(
      chat,
      userContent,
      resolved.systemPromptOverride,
      resolved.knowledgeStoreIdsOverride,
    )

    const provider = await this._resolveProvider(opts, chat, resolved.providerOverride)
    const toolRun = await this._runWithTools(provider, messages, resolved)

    const assistantMessage = await this._db.createMessage({
      id: randomUUID(),
      chatId,
      role: 'assistant',
      content: toolRun.content,
      model: toolRun.model,
      usage: toolRun.usage,
      sources: sources.length > 0 ? sources : null,
      toolCalls: toolRun.toolCallLog.length > 0 ? toolRun.toolCallLog : null,
    })

    if (chat.messages.length === 0 && !(chat['title'] as string | undefined)?.trim()) {
      const title = userContent.slice(0, 60)
      await this._db.updateChat(chatId, { title })
    }

    return { userMessage, assistantMessage }
  }

  async streamMessage(
    chatId: string,
    userContent: string,
    { onChunk, onDone, onError }: StreamCallbacks,
    opts: SendMessageOpts = {},
  ): Promise<void> {
    let chat: Entity & { messages: Entity[] }
    try {
      chat = await this.getChat(chatId)
    } catch (err) {
      return onError(err as AppError)
    }

    await this._db.createMessage({
      id: randomUUID(),
      chatId,
      role: 'user',
      content: userContent,
    })

    const resolved = await this._resolveModelConfig(opts, chat)
    const { messages, sources } = await this._buildMessages(
      chat,
      userContent,
      resolved.systemPromptOverride,
      resolved.knowledgeStoreIdsOverride,
    )
    const provider = await this._resolveProvider(opts, chat, resolved.providerOverride)

    let full = ''
    let toolCallLog: ToolCallEntry[] = []
    try {
      if (resolved.toolIds.length > 0) {
        const toolRun = await this._runWithTools(provider, messages, resolved, onChunk)
        full = toolRun.content
        toolCallLog = toolRun.toolCallLog
        // chunks were emitted inside _runWithTools via onChunk
      } else {
        for await (const chunk of provider.stream(messages, resolved.modelOpts)) {
          full += chunk
          onChunk(chunk)
        }
      }

      const assistantMessage = await this._db.createMessage({
        id: randomUUID(),
        chatId,
        role: 'assistant',
        content: full,
        model: (resolved.modelOpts['model'] ?? opts.model ?? chat['model'] ?? null) as
          | string
          | null,
        sources: sources.length > 0 ? sources : null,
        toolCalls: toolCallLog.length > 0 ? toolCallLog : null,
      })

      onDone(full, assistantMessage, sources.length > 0 ? sources : undefined)
    } catch (err) {
      onError(err as AppError)
    }
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async _buildMessages(
    chat: Entity & { messages: Entity[] },
    newUserContent: string,
    systemPromptOverride?: string,
    knowledgeStoreIdsOverride?: string[],
  ): Promise<{ messages: ModelChatMessage[]; sources: RagSource[] }> {
    const history: ModelChatMessage[] = (chat.messages ?? []).map((m) => ({
      role: m['role'] as string,
      content: m['content'] as string,
    }))

    const knowledgeStoreIds =
      knowledgeStoreIdsOverride ??
      (Array.isArray(chat['knowledgeStoreIds']) ? (chat['knowledgeStoreIds'] as string[]) : [])

    let ragContext = ''
    const sources: RagSource[] = []
    if (this._knowledgeService && knowledgeStoreIds.length > 0) {
      try {
        // Resolve topK from the embedding model of the first knowledge store
        let topK = 5
        try {
          const ks = await this._knowledgeService.getKnowledgeStore(knowledgeStoreIds[0]!)
          const embeddingModelId = ks['embeddingModelId'] as string | null
          if (embeddingModelId) {
            const embModel = await this._db.getAiModel(embeddingModelId)
            if (embModel?.['topK']) topK = embModel['topK'] as number
          }
        } catch {
          /* use default */
        }

        const results = await this._knowledgeService.retrieve(newUserContent, knowledgeStoreIds, {
          topK,
        })
        if (results.length > 0) {
          const chunksText = results.map((r, i) => `[${i + 1}] ${r.text}`).join('\n\n')
          ragContext = config.ragChunkTemplate.replace('{chunks}', chunksText)

          // Resolve document filenames for source references
          for (const r of results) {
            let filename: string | undefined
            if (r.docId) {
              try {
                const doc = await this._knowledgeService.getDocument(r.storeId, r.docId as string)
                filename = doc?.['filename'] as string | undefined
              } catch {
                /* ignore */
              }
            }
            sources.push({
              docId: (r.docId as string) ?? '',
              storeId: r.storeId,
              text: r.text.slice(0, 300),
              score: r.score,
              chunkId: r.id,
              filename,
            })
          }
        }
      } catch (err) {
        logger.error('[ChatService] RAG retrieval failed:', (err as Error).message)
      }
    }

    const messages: ModelChatMessage[] = []

    const systemPrompt =
      systemPromptOverride ??
      (chat['systemPrompt'] as string | null | undefined) ??
      'You are a helpful AI assistant.'

    if (ragContext) {
      messages.push({
        role: 'system',
        content:
          systemPrompt +
          ragContext +
          "\n\nUse the above context to answer the user's question. Cite sources using [1], [2], etc. Do NOT repeat the context verbatim.",
      })
    } else {
      messages.push({ role: 'system', content: systemPrompt })
    }

    messages.push(...history)

    messages.push({ role: 'user', content: newUserContent })

    return { messages, sources }
  }

  private async _resolveProvider(
    opts: SendMessageOpts,
    chat?: Entity,
    providerOverride?: string,
  ): Promise<ModelProviderBase> {
    // 1. Explicit provider from opts
    const providerName =
      providerOverride ?? opts.provider ?? (chat?.['provider'] as string | undefined)

    if (providerName) {
      try {
        return await buildProvider(providerName, this._db)
      } catch (err) {
        logger.error(
          `[ChatService] Failed to build provider "${providerName}":`,
          (err as Error).message,
        )
      }
    }

    // 2. Resolve from modelId → aiModel.provider
    const modelId = opts.modelId ?? (chat?.['modelId'] as string | undefined)
    if (modelId) {
      try {
        const aiModel = await this._db.getAiModel(modelId)
        // G-B19: Handle webhook-type models by instantiating WebhookProvider directly
        if (aiModel?.['type'] === 'webhook' && aiModel['webhookId']) {
          const webhook = await this._db.getWebhook(aiModel['webhookId'] as string)
          if (webhook) {
            return new WebhookProvider({
              url: webhook['url'] as string,
              name: aiModel['name'] as string,
              headers: (webhook['headers'] as Record<string, string> | undefined) ?? {},
            })
          }
        }
        if (aiModel?.['provider']) {
          return await buildProvider(aiModel['provider'] as string, this._db)
        }
        if (aiModel?.['type'] === 'agent' && aiModel['agentId']) {
          const agent = await this._db.getAgent(aiModel['agentId'] as string)
          if (agent?.['provider']) {
            return await buildProvider(agent['provider'] as string, this._db)
          }
        }
      } catch {
        // fall through to default
      }
    }

    // 3. Fallback to default provider
    try {
      return this._getProvider()
    } catch {
      return getDefaultProvider()
    }
  }

  private _buildModelOpts(chat: Entity, opts: SendMessageOpts): Record<string, unknown> {
    return {
      model: opts.model ?? chat['model'] ?? undefined,
      temperature: opts.temperature,
      maxTokens: opts.maxTokens,
    }
  }

  private async _resolveModelConfig(
    opts: SendMessageOpts,
    chat: Entity,
  ): Promise<ResolvedModelConfig> {
    const modelId = opts.modelId ?? (chat['modelId'] as string | undefined)
    if (!modelId) {
      return { modelOpts: this._buildModelOpts(chat, opts), toolIds: [] }
    }
    try {
      const aiModel = await this._db.getAiModel(modelId)
      if (!aiModel) return { modelOpts: this._buildModelOpts(chat, opts), toolIds: [] }

      // If model points to an agent, load the agent config
      if (aiModel['type'] === 'agent' && aiModel['agentId']) {
        const agent = await this._db.getAgent(aiModel['agentId'] as string)
        if (agent) {
          const deploymentName = (agent['deploymentName'] as string | null) ?? null
          const providerModel =
            deploymentName ||
            (agent['providerModel'] as string | null) ||
            opts.model ||
            (chat['model'] as string | undefined)
          return {
            systemPromptOverride: agent['systemPrompt'] as string,
            knowledgeStoreIdsOverride: (agent['knowledgeStoreIds'] as string[]) ?? [],
            toolIds: (agent['toolIds'] as string[]) ?? [],
            providerOverride: (agent['provider'] as string | undefined) ?? undefined,
            modelOpts: {
              model: providerModel ?? undefined,
              temperature: (agent['temperature'] as number | null) ?? opts.temperature,
              maxTokens: (agent['maxTokens'] as number | null) ?? opts.maxTokens,
            },
          }
        }
      }

      const deploymentName = (aiModel['deploymentName'] as string | null) ?? null
      const providerModel =
        deploymentName ||
        (aiModel['providerModel'] as string | null) ||
        opts.model ||
        (chat['model'] as string | undefined)
      return {
        systemPromptOverride: (aiModel['systemPrompt'] as string | null) ?? undefined,
        knowledgeStoreIdsOverride: (aiModel['knowledgeStoreIds'] as string[]) ?? undefined,
        toolIds: (aiModel['toolIds'] as string[]) ?? [],
        providerOverride: (aiModel['provider'] as string | undefined) ?? undefined,
        modelOpts: {
          model: providerModel ?? undefined,
          temperature: (aiModel['temperature'] as number | null) ?? opts.temperature,
          maxTokens: (aiModel['maxTokens'] as number | null) ?? opts.maxTokens,
        },
      }
    } catch {
      return { modelOpts: this._buildModelOpts(chat, opts), toolIds: [] }
    }
  }

  private async _runWithTools(
    provider: ModelProviderBase,
    baseMessages: ModelChatMessage[],
    resolved: ResolvedModelConfig,
    onProgress?: (chunk: string) => void,
  ): Promise<ToolRunResult> {
    if (!resolved.toolIds.length) {
      const r = await provider.chat(baseMessages, resolved.modelOpts)
      return {
        content: r.content,
        model: r.model,
        usage: r.usage,
        finishReason: r.finishReason,
        toolCallLog: [],
      }
    }

    const tools = await this._resolveTools(resolved.toolIds)
    if (!tools.length) {
      const r = await provider.chat(baseMessages, resolved.modelOpts)
      return {
        content: r.content,
        model: r.model,
        usage: r.usage,
        finishReason: r.finishReason,
        toolCallLog: [],
      }
    }

    if (provider.supportsTools()) {
      return this._runNativeToolLoop(provider, baseMessages, resolved.modelOpts, tools, onProgress)
    }
    return this._runPromptToolLoop(provider, baseMessages, resolved.modelOpts, tools, onProgress)
  }

  private async _resolveTools(toolIds: string[]): Promise<ToolEntity[]> {
    const found: ToolEntity[] = []
    for (const toolId of toolIds) {
      const tool = await this._db.getTool(toolId)
      if (!tool || tool['enabled'] === false) continue
      found.push({
        id: tool['id'] as string,
        name: tool['name'] as string,
        description: (tool['description'] as string | null) ?? null,
        type: tool['type'] as 'mcp' | 'python' | 'typescript',
        config: (tool['config'] as Record<string, unknown>) ?? {},
        enabled: tool['enabled'] !== false,
      })
    }
    return found
  }

  private _buildToolPrompt(tools: ToolEntity[]): string {
    const defs: ToolDefinition[] = tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? '',
      inputSchema: (tool.config['args_schema'] as Record<string, unknown> | undefined) ?? {
        type: 'object',
        properties: {},
      },
    }))

    return [
      'You can use tools when needed.',
      'If you need a tool, respond ONLY with valid JSON in this format:',
      '{"tool_calls":[{"name":"<tool-name>","arguments":{...}}]}',
      'When you are ready to answer the user directly, respond with normal text.',
      'Available tools:',
      JSON.stringify(defs, null, 2),
    ].join('\n')
  }

  private _extractToolCalls(raw: string): ToolCall[] {
    const trimmed = raw.trim()
    let candidate = trimmed

    const fenced = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i)
    if (fenced && fenced[1]) candidate = fenced[1].trim()

    try {
      const parsed = JSON.parse(candidate) as Record<string, unknown>
      const calls = Array.isArray(parsed['tool_calls']) ? parsed['tool_calls'] : []
      return calls
        .map((c, idx) => {
          const call = c as Record<string, unknown>
          const name = typeof call['name'] === 'string' ? call['name'] : ''
          const args =
            call['arguments'] && typeof call['arguments'] === 'object'
              ? (call['arguments'] as Record<string, unknown>)
              : {}
          if (!name) return null
          return {
            id: `tool_${idx + 1}`,
            name,
            arguments: args,
          }
        })
        .filter((v): v is ToolCall => v !== null)
    } catch {
      return []
    }
  }

  private async _runNativeToolLoop(
    provider: ModelProviderBase,
    baseMessages: ModelChatMessage[],
    modelOpts: Record<string, unknown>,
    tools: ToolEntity[],
    onProgress?: (chunk: string) => void,
  ): Promise<ToolRunResult> {
    if (!this._toolExecutionService) {
      throw Object.assign(new Error('Tool execution service is unavailable'), { status: 500 })
    }

    const toolByName = new Map(tools.map((t) => [t.name.toLowerCase(), t]))
    const toolDefs: ToolDefinition[] = tools.map((tool) => ({
      name: tool.name,
      description: tool.description ?? '',
      inputSchema: (tool.config['args_schema'] as Record<string, unknown> | undefined) ?? {
        type: 'object',
        properties: {},
      },
    }))

    const messages: ModelChatMessage[] = [...baseMessages]
    const optsWithTools = { ...modelOpts, tools: toolDefs }
    const toolCallLog: ToolCallEntry[] = []

    for (let i = 0; i < 6; i += 1) {
      const result = await provider.chat(messages, optsWithTools)

      if (!result.toolCalls?.length) {
        // Final answer — stream it if a progress callback was supplied
        if (onProgress) {
          let finalContent = ''
          try {
            for await (const chunk of provider.stream(messages, modelOpts)) {
              finalContent += chunk
              onProgress(chunk)
            }
          } catch {
            // Provider doesn't support streaming — emit the already-fetched content
            finalContent = result.content
            if (finalContent) onProgress(finalContent)
          }
          return {
            content: finalContent || result.content,
            model: result.model,
            usage: result.usage,
            finishReason: result.finishReason,
            toolCallLog,
          }
        }
        return {
          content: result.content,
          model: result.model,
          usage: result.usage,
          finishReason: result.finishReason,
          toolCallLog,
        }
      }

      // Add assistant message with tool calls
      messages.push({
        role: 'assistant',
        content: result.content || '',
        toolCalls: result.toolCalls,
      })

      // Execute each tool call and collect results
      for (const call of result.toolCalls) {
        const tool = toolByName.get(call.name.toLowerCase())
        const entry: ToolCallEntry = {
          id: call.id,
          name: call.name,
          arguments: call.arguments,
          result: '',
        }
        let output: string
        if (!tool) {
          output = JSON.stringify({ ok: false, error: `Unknown tool: ${call.name}` })
          entry.result = output
          entry.error = `Unknown tool: ${call.name}`
        } else {
          try {
            const execResult = await this._toolExecutionService!.executeTool(tool, call.arguments)
            output = typeof execResult === 'string' ? execResult : JSON.stringify(execResult)
            entry.result = output
          } catch (err) {
            output = JSON.stringify({ ok: false, error: (err as Error).message })
            entry.result = output
            entry.error = (err as Error).message
          }
        }
        toolCallLog.push(entry)

        messages.push({
          role: 'tool',
          content: output,
          toolCallId: call.id,
        })
      }
    }

    throw Object.assign(new Error('Tool loop exceeded maximum iterations'), { status: 502 })
  }

  private async _runPromptToolLoop(
    provider: ModelProviderBase,
    baseMessages: ModelChatMessage[],
    modelOpts: Record<string, unknown>,
    tools: ToolEntity[],
    onProgress?: (chunk: string) => void,
  ): Promise<ToolRunResult> {
    if (!this._toolExecutionService) {
      throw Object.assign(new Error('Tool execution service is unavailable'), { status: 500 })
    }

    const toolByName = new Map(tools.map((t) => [t.name.toLowerCase(), t]))
    const messages: ModelChatMessage[] = [...baseMessages]
    const toolPrompt = this._buildToolPrompt(tools)
    const toolCallLog: ToolCallEntry[] = []

    if (messages[0]?.role === 'system') {
      messages[0] = {
        ...messages[0],
        content: `${messages[0].content}\n\n${toolPrompt}`,
      }
    } else {
      messages.unshift({ role: 'system', content: toolPrompt })
    }

    for (let i = 0; i < 6; i += 1) {
      const result = await provider.chat(messages, modelOpts)
      const toolCalls = this._extractToolCalls(result.content)
      if (!toolCalls.length) {
        // Final answer — stream it if a progress callback was supplied
        if (onProgress) {
          let finalContent = ''
          try {
            for await (const chunk of provider.stream(messages, modelOpts)) {
              finalContent += chunk
              onProgress(chunk)
            }
          } catch {
            finalContent = result.content
            if (finalContent) onProgress(finalContent)
          }
          return { content: finalContent || result.content, toolCallLog }
        }
        return { content: result.content, toolCallLog }
      }

      const executed: Array<Record<string, unknown>> = []
      for (const call of toolCalls) {
        const tool = toolByName.get(call.name.toLowerCase())
        const entry: ToolCallEntry = {
          id: call.id,
          name: call.name,
          arguments: call.arguments,
          result: '',
        }
        if (!tool) {
          const out = JSON.stringify({ ok: false, error: `Unknown tool: ${call.name}` })
          executed.push({ tool: call.name, ok: false, error: `Unknown tool: ${call.name}` })
          entry.result = out
          entry.error = `Unknown tool: ${call.name}`
        } else {
          try {
            const output = await this._toolExecutionService.executeTool(tool, call.arguments)
            const outStr = typeof output === 'string' ? output : JSON.stringify(output)
            executed.push({ tool: tool.name, ok: true, output })
            entry.result = outStr
          } catch (err) {
            executed.push({ tool: tool.name, ok: false, error: (err as Error).message })
            entry.result = JSON.stringify({ ok: false, error: (err as Error).message })
            entry.error = (err as Error).message
          }
        }
        toolCallLog.push(entry)
      }

      messages.push({ role: 'assistant', content: result.content })
      messages.push({
        role: 'user',
        content:
          'Tool results (JSON):\n' +
          JSON.stringify(executed, null, 2) +
          '\n\nNow continue and answer the user directly.',
      })
    }

    throw Object.assign(new Error('Tool loop exceeded maximum iterations'), { status: 502 })
  }

  private async _assertExists(id: string): Promise<Entity> {
    const chat = await this._db.getChat(id)
    if (!chat) {
      const err: AppError = new Error(`Chat not found: ${id}`)
      err.status = 404
      throw err
    }
    return chat
  }
}

export default ChatService
