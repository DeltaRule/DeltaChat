'use strict';

import { GoogleGenerativeAI } from '@google/generative-ai';
import ModelProviderBase, { ChatMessage, ChatResult, ModelOptions } from './ModelProviderBase';
import config from '../../config';

interface GeminiProviderOpts {
  apiKey?: string;
  defaultModel?: string;
}

interface GeminiHistoryPart {
  text: string;
}

interface GeminiHistoryEntry {
  role: 'user' | 'model';
  parts: GeminiHistoryPart[];
}

class GeminiProvider extends ModelProviderBase {
  private _genAI: GoogleGenerativeAI;
  private _defaultModel: string;

  constructor(opts: GeminiProviderOpts = {}) {
    super();
    this._genAI = new GoogleGenerativeAI(opts.apiKey ?? config.gemini.apiKey);
    this._defaultModel = opts.defaultModel ?? config.gemini.defaultModel;
  }

  getName(): string {
    return 'gemini';
  }

  async getModels(): Promise<string[]> {
    return ['gemini-pro', 'gemini-pro-vision', 'gemini-1.5-pro', 'gemini-1.5-flash'];
  }

  _convertMessages(messages: ChatMessage[]): { history: GeminiHistoryEntry[]; prompt: string } {
    const history: GeminiHistoryEntry[] = [];
    let lastUserMessage = '';

    for (const msg of messages) {
      if (msg.role === 'system') {
        history.push({ role: 'user', parts: [{ text: msg.content }] });
        history.push({ role: 'model', parts: [{ text: 'Understood.' }] });
      } else if (msg.role === 'user') {
        lastUserMessage = msg.content;
        history.push({ role: 'user', parts: [{ text: msg.content }] });
      } else if (msg.role === 'assistant') {
        history.push({ role: 'model', parts: [{ text: msg.content }] });
      }
    }

    if (history.length > 0 && history[history.length - 1].role === 'user') {
      history.pop();
    }

    return { history, prompt: lastUserMessage };
  }

  async chat(messages: ChatMessage[], options: ModelOptions = {}): Promise<ChatResult> {
    const modelName = options.model ?? this._defaultModel;
    const model = this._genAI.getGenerativeModel({ model: modelName });
    const { history, prompt } = this._convertMessages(messages);

    const chat = model.startChat({
      history,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens,
      },
    });

    const result = await chat.sendMessage(prompt);
    const text = result.response.text();

    return {
      content: text,
      role: 'assistant',
      model: modelName,
      usage: ((result.response as unknown as Record<string, unknown>)['usageMetadata'] ?? {}) as Record<string, unknown>,
      finishReason: result.response.candidates?.[0]?.finishReason?.toString() ?? 'STOP',
    };
  }

  async *stream(messages: ChatMessage[], options: ModelOptions = {}): AsyncGenerator<string> {
    const modelName = options.model ?? this._defaultModel;
    const model = this._genAI.getGenerativeModel({ model: modelName });
    const { history, prompt } = this._convertMessages(messages);

    const chat = model.startChat({
      history,
      generationConfig: {
        temperature: options.temperature ?? 0.7,
        maxOutputTokens: options.maxTokens,
      },
    });

    const result = await chat.sendMessageStream(prompt);
    for await (const chunk of result.stream) {
      const text = chunk.text();
      if (text) yield text;
    }
  }
}

export default GeminiProvider;
