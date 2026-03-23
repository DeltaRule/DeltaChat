'use strict'

import axios, { AxiosInstance } from 'axios'
import ModelProviderBase, { ChatMessage, ChatResult, ModelOptions } from './ModelProviderBase'
import config from '../../config'

interface CohereProviderOpts {
  apiKey?: string
  defaultModel?: string
}

interface CohereMessage {
  role: 'USER' | 'CHATBOT' | 'SYSTEM'
  message: string
}

interface CohereChatResponse {
  text: string
  generation_id?: string
  meta?: {
    billed_units?: { input_tokens?: number; output_tokens?: number }
  }
  finish_reason?: string
}

class CohereProvider extends ModelProviderBase {
  private _http: AxiosInstance
  private _defaultModel: string

  constructor(opts: CohereProviderOpts = {}) {
    super()
    const apiKey = opts.apiKey ?? config.cohere.apiKey
    this._http = axios.create({
      baseURL: 'https://api.cohere.com/v2',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 120000,
    })
    this._defaultModel = opts.defaultModel ?? config.cohere.defaultModel
  }

  getName(): string {
    return 'cohere'
  }

  async getModels(): Promise<string[]> {
    return ['command-r-plus', 'command-r', 'command', 'command-light']
  }

  async chat(messages: ChatMessage[], options: ModelOptions = {}): Promise<ChatResult> {
    const model = options.model ?? this._defaultModel
    const { system, chatHistory, lastMessage } = this._convertMessages(messages)

    const { data } = await this._http.post<CohereChatResponse>('/chat', {
      model,
      message: lastMessage,
      chat_history: chatHistory,
      ...(system ? { preamble: system } : {}),
      temperature: options.temperature ?? 0.7,
      ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
    })

    return {
      content: data.text ?? '',
      role: 'assistant',
      model,
      usage: {
        input_tokens: data.meta?.billed_units?.input_tokens,
        output_tokens: data.meta?.billed_units?.output_tokens,
      },
      finishReason: data.finish_reason ?? 'COMPLETE',
    }
  }

  async *stream(messages: ChatMessage[], options: ModelOptions = {}): AsyncGenerator<string> {
    const model = options.model ?? this._defaultModel
    const { system, chatHistory, lastMessage } = this._convertMessages(messages)

    const response = await this._http.post(
      '/chat',
      {
        model,
        message: lastMessage,
        chat_history: chatHistory,
        ...(system ? { preamble: system } : {}),
        temperature: options.temperature ?? 0.7,
        ...(options.maxTokens ? { max_tokens: options.maxTokens } : {}),
        stream: true,
      },
      { responseType: 'stream' },
    )

    const stream = response.data as NodeJS.ReadableStream
    let buffer = ''

    for await (const rawChunk of stream) {
      buffer += rawChunk.toString()
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        const trimmed = line.trim()
        if (!trimmed) continue
        try {
          const json = JSON.parse(trimmed) as Record<string, unknown>
          if (json['event_type'] === 'text-generation') {
            const text = json['text'] as string | undefined
            if (text) yield text
          }
        } catch {
          // skip malformed lines
        }
      }
    }
  }

  private _convertMessages(messages: ChatMessage[]): {
    system: string | undefined
    chatHistory: CohereMessage[]
    lastMessage: string
  } {
    let system: string | undefined
    const chatHistory: CohereMessage[] = []
    let lastMessage = ''

    for (const msg of messages) {
      if (msg.role === 'system') {
        system = msg.content
      } else if (msg.role === 'user') {
        lastMessage = msg.content
        chatHistory.push({ role: 'USER', message: msg.content })
      } else if (msg.role === 'assistant') {
        chatHistory.push({ role: 'CHATBOT', message: msg.content })
      }
    }

    // Remove the last user message from history (it becomes `message`)
    if (chatHistory.length > 0 && chatHistory[chatHistory.length - 1].role === 'USER') {
      chatHistory.pop()
    }

    return { system, chatHistory, lastMessage }
  }
}

export default CohereProvider
