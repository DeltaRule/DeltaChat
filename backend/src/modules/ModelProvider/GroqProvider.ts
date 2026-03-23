'use strict'

import OpenAI from 'openai'
import ModelProviderBase, { ChatMessage, ChatResult, ModelOptions } from './ModelProviderBase'
import config from '../../config'

interface GroqProviderOpts {
  apiKey?: string
  defaultModel?: string
}

class GroqProvider extends ModelProviderBase {
  private _client: OpenAI
  private _defaultModel: string

  constructor(opts: GroqProviderOpts = {}) {
    super()
    this._client = new OpenAI({
      apiKey: opts.apiKey ?? config.groq.apiKey,
      baseURL: 'https://api.groq.com/openai/v1',
    })
    this._defaultModel = opts.defaultModel ?? config.groq.defaultModel
  }

  getName(): string {
    return 'groq'
  }

  supportsTools(): boolean {
    return true
  }

  async getModels(): Promise<string[]> {
    try {
      const list = await this._client.models.list()
      return list.data.map((m) => m.id).sort()
    } catch {
      return [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'mixtral-8x7b-32768',
        'gemma2-9b-it',
      ]
    }
  }

  async chat(messages: ChatMessage[], options: ModelOptions = {}): Promise<ChatResult> {
    const model = options.model ?? this._defaultModel
    const msgParams = messages as import('openai/resources/chat').ChatCompletionMessageParam[]
    const response = await this._client.chat.completions.create({
      model,
      messages: msgParams,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
      top_p: options.topP,
      ...(options.tools?.length
        ? {
            tools: options.tools.map((tool) => ({
              type: 'function' as const,
              function: {
                name: tool.name,
                description: tool.description,
                parameters: tool.inputSchema ?? { type: 'object', properties: {} },
              },
            })),
            tool_choice: 'auto' as const,
          }
        : {}),
      stream: false,
    })
    const choice = response.choices[0]
    const toolCalls =
      choice.message.tool_calls
        ?.map((call) => {
          if (!('function' in call)) return null
          let args: Record<string, unknown> = {}
          try {
            args = JSON.parse(call.function.arguments || '{}') as Record<string, unknown>
          } catch {
            // keep default empty args
          }
          return {
            id: call.id,
            name: call.function.name,
            arguments: args,
          }
        })
        .filter(
          (call): call is { id: string; name: string; arguments: Record<string, unknown> } =>
            call !== null,
        ) ?? []
    return {
      content: choice.message.content ?? '',
      role: choice.message.role,
      model: response.model,
      usage: response.usage as unknown as Record<string, unknown>,
      finishReason: choice.finish_reason,
      toolCalls,
    }
  }

  async *stream(messages: ChatMessage[], options: ModelOptions = {}): AsyncGenerator<string> {
    const model = options.model ?? this._defaultModel
    const msgParams = messages as import('openai/resources/chat').ChatCompletionMessageParam[]
    const stream = await this._client.chat.completions.create({
      model,
      messages: msgParams,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
      top_p: options.topP,
      stream: true,
    })
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content
      if (delta) yield delta
    }
  }
}

export default GroqProvider
