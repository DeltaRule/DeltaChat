'use strict';

import OpenAI from 'openai';
import ModelProviderBase, { ChatMessage, ChatResult, ModelOptions } from './ModelProviderBase';
import config from '../../config';

interface OpenAIProviderOpts {
  apiKey?: string;
  defaultModel?: string;
}

class OpenAIProvider extends ModelProviderBase {
  private _client: OpenAI;
  private _defaultModel: string;

  constructor(opts: OpenAIProviderOpts = {}) {
    super();
    this._client = new OpenAI({
      apiKey: opts.apiKey ?? config.openai.apiKey,
    });
    this._defaultModel = opts.defaultModel ?? config.openai.defaultModel;
  }

  getName(): string {
    return 'openai';
  }

  async getModels(): Promise<string[]> {
    const list = await this._client.models.list();
    return list.data
      .filter((m) => m.id.startsWith('gpt'))
      .map((m) => m.id)
      .sort();
  }

  async chat(messages: ChatMessage[], options: ModelOptions = {}): Promise<ChatResult> {
    const model = options.model ?? this._defaultModel;
    const msgParams = messages as import('openai/resources/chat').ChatCompletionMessageParam[];
    const response = await this._client.chat.completions.create({
      model,
      messages: msgParams,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
      top_p: options.topP,
      stream: false,
    });
    const choice = response.choices[0];
    return {
      content: choice.message.content ?? '',
      role: choice.message.role,
      model: response.model,
      usage: response.usage as unknown as Record<string, unknown>,
      finishReason: choice.finish_reason,
    };
  }

  async *stream(messages: ChatMessage[], options: ModelOptions = {}): AsyncGenerator<string> {
    const model = options.model ?? this._defaultModel;
    const msgParams = messages as import('openai/resources/chat').ChatCompletionMessageParam[];
    const stream = await this._client.chat.completions.create({
      model,
      messages: msgParams,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
      top_p: options.topP,
      stream: true,
    });
    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content;
      if (delta) yield delta;
    }
  }
}

export default OpenAIProvider;
