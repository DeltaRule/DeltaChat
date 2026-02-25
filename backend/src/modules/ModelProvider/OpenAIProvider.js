'use strict';

const OpenAI = require('openai');
const ModelProviderBase = require('./ModelProviderBase');
const config = require('../../config');

/**
 * OpenAIProvider
 *
 * Wraps the official OpenAI Node SDK.  Supports both regular (non-streaming)
 * and streaming chat completions via the OpenAI Chat Completions API.
 */
class OpenAIProvider extends ModelProviderBase {
  /**
   * @param {object} [opts]
   * @param {string} [opts.apiKey]      - OpenAI API key (defaults to config).
   * @param {string} [opts.defaultModel] - Model to use when none is specified.
   */
  constructor(opts = {}) {
    super();
    this._client = new OpenAI({
      apiKey: opts.apiKey || config.openai.apiKey,
    });
    this._defaultModel = opts.defaultModel || config.openai.defaultModel;
  }

  getName() {
    return 'openai';
  }

  async getModels() {
    const list = await this._client.models.list();
    return list.data
      .filter((m) => m.id.startsWith('gpt'))
      .map((m) => m.id)
      .sort();
  }

  async chat(messages, options = {}) {
    const model = options.model || this._defaultModel;
    const response = await this._client.chat.completions.create({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens,
      top_p: options.topP,
      stream: false,
    });
    const choice = response.choices[0];
    return {
      content: choice.message.content,
      role: choice.message.role,
      model: response.model,
      usage: response.usage,
      finishReason: choice.finish_reason,
    };
  }

  async *stream(messages, options = {}) {
    const model = options.model || this._defaultModel;
    const stream = await this._client.chat.completions.create({
      model,
      messages,
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

module.exports = OpenAIProvider;
