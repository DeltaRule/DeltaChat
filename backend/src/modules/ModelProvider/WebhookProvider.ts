'use strict';

import axios from 'axios';
import ModelProviderBase, { ChatMessage, ChatResult, ModelOptions } from './ModelProviderBase';

interface WebhookProviderOpts {
  url: string;
  name?: string;
  headers?: Record<string, string>;
  metadata?: Record<string, unknown>;
  timeout?: number;
}

class WebhookProvider extends ModelProviderBase {
  private _url: string;
  private _name: string;
  private _headers: Record<string, string>;
  private _metadata: Record<string, unknown>;
  private _timeout: number;

  constructor(opts: WebhookProviderOpts) {
    super();
    if (!opts.url) throw new Error('WebhookProvider requires opts.url');
    this._url = opts.url;
    this._name = opts.name ?? `webhook:${opts.url}`;
    this._headers = opts.headers ?? {};
    this._metadata = opts.metadata ?? {};
    this._timeout = opts.timeout ?? 30000;
  }

  getName(): string {
    return this._name;
  }

  async getModels(): Promise<string[]> {
    return ['webhook-default'];
  }

  async chat(messages: ChatMessage[], options: ModelOptions = {}): Promise<ChatResult> {
    const body = {
      messages,
      options,
      metadata: this._metadata,
    };

    const response = await axios.post(this._url, body, {
      headers: { 'Content-Type': 'application/json', ...this._headers },
      timeout: this._timeout,
    });

    const data = response.data as Record<string, unknown>;
    const content = this._extractContent(data);

    return {
      content,
      role: 'assistant',
      model: this._name,
      usage: (data['usage'] ?? {}) as Record<string, unknown>,
      finishReason: (data['finishReason'] as string | undefined) ?? 'stop',
    };
  }

  async *stream(messages: ChatMessage[], options: ModelOptions = {}): AsyncGenerator<string> {
    const result = await this.chat(messages, options);
    yield result.content;
  }

  private _extractContent(data: Record<string, unknown>): string {
    if (typeof data === 'string') return data;
    if (typeof data['content'] === 'string') return data['content'];
    if (typeof data['text'] === 'string') return data['text'];
    if (typeof data['message'] === 'string') return data['message'];
    const choices = data['choices'];
    if (Array.isArray(choices) && choices.length > 0) {
      const first = choices[0] as Record<string, unknown>;
      const msg = first['message'] as Record<string, unknown> | undefined;
      if (typeof msg?.['content'] === 'string') return msg['content'];
    }
    throw new Error(
      `WebhookProvider: could not extract content from response: ${JSON.stringify(data)}`
    );
  }
}

export default WebhookProvider;
