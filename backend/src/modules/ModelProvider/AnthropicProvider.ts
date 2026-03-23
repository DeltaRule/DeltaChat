'use strict'

import ModelProviderBase, { ChatMessage, ChatResult, ModelOptions } from './ModelProviderBase'
import config from '../../config'

interface AnthropicProviderOpts {
  apiKey?: string
  defaultModel?: string
}

interface AnthropicMessage {
  role: 'user' | 'assistant'
  content: string
}

class AnthropicProvider extends ModelProviderBase {
  private _client: any
  private _defaultModel: string
  private _apiKey: string
  private _initialized = false

  constructor(opts: AnthropicProviderOpts = {}) {
    super()
    this._apiKey = opts.apiKey ?? config.anthropic.apiKey
    this._defaultModel = opts.defaultModel ?? config.anthropic.defaultModel
  }

  private async _init(): Promise<any> {
    if (!this._initialized) {
      const Anthropic = require('@anthropic-ai/sdk').default as any
      this._client = new Anthropic({ apiKey: this._apiKey })
      this._initialized = true
    }
    return this._client
  }

  getName(): string {
    return 'anthropic'
  }

  async getModels(): Promise<string[]> {
    return [
      'claude-sonnet-4-20250514',
      'claude-opus-4-20250514',
      'claude-3-5-sonnet-20241022',
      'claude-3-5-haiku-20241022',
      'claude-3-opus-20240229',
    ]
  }

  async chat(messages: ChatMessage[], options: ModelOptions = {}): Promise<ChatResult> {
    const client = await this._init()
    const model = options.model ?? this._defaultModel
    const { system, anthropicMessages } = this._convertMessages(messages)

    const response = await client.messages.create({
      model,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.7,
      ...(system ? { system } : {}),
      messages: anthropicMessages,
    })

    const content = response.content
      .filter((block: any) => block.type === 'text')
      .map((block: any) => block.text)
      .join('')

    return {
      content,
      role: 'assistant',
      model: response.model,
      usage: {
        input_tokens: response.usage.input_tokens,
        output_tokens: response.usage.output_tokens,
      },
      finishReason: response.stop_reason ?? 'end_turn',
    }
  }

  async *stream(messages: ChatMessage[], options: ModelOptions = {}): AsyncGenerator<string> {
    const client = await this._init()
    const model = options.model ?? this._defaultModel
    const { system, anthropicMessages } = this._convertMessages(messages)

    const stream = client.messages.stream({
      model,
      max_tokens: options.maxTokens ?? 4096,
      temperature: options.temperature ?? 0.7,
      ...(system ? { system } : {}),
      messages: anthropicMessages,
    })

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield event.delta.text
      }
    }
  }

  private _convertMessages(messages: ChatMessage[]): {
    system: string | undefined
    anthropicMessages: AnthropicMessage[]
  } {
    let system: string | undefined
    const anthropicMessages: AnthropicMessage[] = []

    for (const msg of messages) {
      if (msg.role === 'system') {
        system = msg.content
      } else {
        anthropicMessages.push({
          role: msg.role === 'assistant' ? 'assistant' : 'user',
          content: msg.content,
        })
      }
    }

    return { system, anthropicMessages }
  }
}

export default AnthropicProvider
