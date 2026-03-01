'use strict';

import axios, { AxiosInstance } from 'axios';
import ModelProviderBase, { ChatMessage, ChatResult, ModelOptions } from './ModelProviderBase';
import config from '../../config';

interface OllamaProviderOpts {
  baseUrl?: string;
  defaultModel?: string;
}

interface OllamaChatResponse {
  model: string;
  message: { role: string; content: string };
  done: boolean;
  total_duration?: number;
  eval_count?: number;
  prompt_eval_count?: number;
}

class OllamaProvider extends ModelProviderBase {
  private _baseUrl: string;
  private _defaultModel: string;
  private _http: AxiosInstance;

  constructor(opts: OllamaProviderOpts = {}) {
    super();
    this._baseUrl = (opts.baseUrl ?? config.ollama.baseUrl).replace(/\/$/, '');
    this._defaultModel = opts.defaultModel ?? config.ollama.defaultModel;
    this._http = axios.create({
      baseURL: this._baseUrl,
      timeout: 120000, // Ollama can be slow on first load
    });
  }

  getName(): string {
    return 'ollama';
  }

  async getModels(): Promise<string[]> {
    try {
      const { data } = await this._http.get('/api/tags');
      const models = data?.models ?? [];
      return models.map((m: { name: string }) => m.name).sort();
    } catch (err) {
      console.error('[OllamaProvider] Failed to list models:', (err as Error).message);
      return [];
    }
  }

  async chat(messages: ChatMessage[], options: ModelOptions = {}): Promise<ChatResult> {
    const model = options.model ?? this._defaultModel;

    const { data } = await this._http.post<OllamaChatResponse>('/api/chat', {
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: false,
      options: {
        temperature: options.temperature ?? 0.7,
        ...(options.maxTokens ? { num_predict: options.maxTokens } : {}),
      },
    });

    return {
      content: data.message?.content ?? '',
      role: data.message?.role ?? 'assistant',
      model: data.model ?? model,
      usage: {
        eval_count: data.eval_count,
        prompt_eval_count: data.prompt_eval_count,
        total_duration: data.total_duration,
      },
      finishReason: data.done ? 'stop' : 'length',
    };
  }

  async *stream(messages: ChatMessage[], options: ModelOptions = {}): AsyncGenerator<string> {
    const model = options.model ?? this._defaultModel;

    const response = await this._http.post('/api/chat', {
      model,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
      stream: true,
      options: {
        temperature: options.temperature ?? 0.7,
        ...(options.maxTokens ? { num_predict: options.maxTokens } : {}),
      },
    }, {
      responseType: 'stream',
      timeout: 120000,
    });

    const stream = response.data as NodeJS.ReadableStream;
    let buffer = '';

    for await (const rawChunk of stream) {
      buffer += rawChunk.toString();
      const lines = buffer.split('\n');
      // Keep the last potentially incomplete line in the buffer
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;
        try {
          const json = JSON.parse(trimmed) as OllamaChatResponse;
          const content = json.message?.content;
          if (content) yield content;
          if (json.done) return;
        } catch {
          // Skip malformed JSON lines
        }
      }
    }

    // Process remaining buffer
    if (buffer.trim()) {
      try {
        const json = JSON.parse(buffer.trim()) as OllamaChatResponse;
        const content = json.message?.content;
        if (content) yield content;
      } catch {
        // Skip
      }
    }
  }
}

export default OllamaProvider;
