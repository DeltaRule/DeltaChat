'use strict'

import { AzureOpenAI } from 'openai'
import ModelProviderBase, { ChatMessage, ChatResult, ModelOptions } from './ModelProviderBase'
import config from '../../config'

interface AzureOpenAIProviderOpts {
  apiKey?: string
  endpoint?: string
  defaultModel?: string
  apiVersion?: string
}

class AzureOpenAIProvider extends ModelProviderBase {
  private _client: AzureOpenAI
  private _defaultModel: string

  constructor(opts: AzureOpenAIProviderOpts = {}) {
    super()
    this._client = new AzureOpenAI({
      apiKey: opts.apiKey ?? config.azureOpenai.apiKey,
      endpoint: opts.endpoint ?? config.azureOpenai.endpoint,
      apiVersion: opts.apiVersion ?? config.azureOpenai.apiVersion,
    })
    this._defaultModel = opts.defaultModel ?? config.azureOpenai.defaultModel
  }

  getName(): string {
    return 'azure'
  }

  supportsTools(): boolean {
    return true
  }

  async getModels(): Promise<string[]> {
    try {
      const list = await this._client.models.list()
      return list.data.map((m) => m.id).sort()
    } catch {
      return [this._defaultModel]
    }
  }

  private _mapMessages(
    messages: ChatMessage[],
  ): import('openai/resources/chat').ChatCompletionMessageParam[] {
    return messages.map((m) => {
      if (m.role === 'tool' && m.toolCallId) {
        return { role: 'tool' as const, content: m.content, tool_call_id: m.toolCallId }
      }
      if (m.role === 'assistant' && m.toolCalls?.length) {
        return {
          role: 'assistant' as const,
          content: m.content || null,
          tool_calls: m.toolCalls.map((tc) => ({
            id: tc.id,
            type: 'function' as const,
            function: { name: tc.name, arguments: JSON.stringify(tc.arguments) },
          })),
        }
      }
      return {
        role: m.role,
        content: m.content,
      } as import('openai/resources/chat').ChatCompletionMessageParam
    })
  }

  async chat(messages: ChatMessage[], options: ModelOptions = {}): Promise<ChatResult> {
    const model = options.model ?? this._defaultModel
    const msgParams = this._mapMessages(messages)
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
    const msgParams = this._mapMessages(messages)
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

export default AzureOpenAIProvider
