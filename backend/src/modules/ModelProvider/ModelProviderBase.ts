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
  abstract chat(messages: ChatMessage[], options?: ModelOptions): Promise<ChatResult>

  abstract stream(messages: ChatMessage[], options?: ModelOptions): AsyncGenerator<string>

  /** Override to return true if the provider supports tool/function calls. */
  supportsTools(): boolean {
    return false
  }

  abstract getName(): string

  abstract getModels(): Promise<string[]>
}

export default ModelProviderBase
