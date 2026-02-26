'use strict';

export interface ChatMessage {
  role: string;
  content: string;
}

export interface ChatResult {
  content: string;
  role: string;
  model: string;
  usage: Record<string, unknown>;
  finishReason?: string;
}

export interface ModelOptions {
  model?: string;
  temperature?: number;
  maxTokens?: number;
  topP?: number;
}

/**
 * ModelProviderBase – abstract base class for all AI model providers.
 */
abstract class ModelProviderBase {
  async chat(_messages: ChatMessage[], _options?: ModelOptions): Promise<ChatResult> {
    throw new Error(`${this.constructor.name} must implement chat(messages, options)`);
  }

  async *stream(_messages: ChatMessage[], _options?: ModelOptions): AsyncGenerator<string> {
    throw new Error(`${this.constructor.name} must implement stream(messages, options)`);
  }

  getName(): string {
    throw new Error(`${this.constructor.name} must implement getName()`);
  }

  async getModels(): Promise<string[]> {
    throw new Error(`${this.constructor.name} must implement getModels()`);
  }
}

export default ModelProviderBase;
