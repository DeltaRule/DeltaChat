'use strict'

export interface ChatMessage {
  role: string
  content: string
  name?: string
  toolCallId?: string
  toolCalls?: ToolCall[]
}

export interface ToolDefinition {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export interface ToolCall {
  id: string
  name: string
  arguments: Record<string, unknown>
}

export interface ChatResult {
  content: string
  role: string
  model: string
  usage: Record<string, unknown>
  finishReason?: string
  toolCalls?: ToolCall[]
}

export interface ModelOptions {
  model?: string
  temperature?: number
  maxTokens?: number
  topP?: number
  tools?: ToolDefinition[]
}

/**
 * ModelProviderBase – abstract base class for all AI model providers.
 */
abstract class ModelProviderBase {
  async chat(_messages: ChatMessage[], _options?: ModelOptions): Promise<ChatResult> {
    throw new Error(`${this.constructor.name} must implement chat(messages, options)`)
  }

  async *stream(_messages: ChatMessage[], _options?: ModelOptions): AsyncGenerator<string> {
    throw new Error(`${this.constructor.name} must implement stream(messages, options)`)
  }

  supportsTools(): boolean {
    return false
  }

  getName(): string {
    throw new Error(`${this.constructor.name} must implement getName()`)
  }

  async getModels(): Promise<string[]> {
    throw new Error(`${this.constructor.name} must implement getModels()`)
  }
}

export default ModelProviderBase
