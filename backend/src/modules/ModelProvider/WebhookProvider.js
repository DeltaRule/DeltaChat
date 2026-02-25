'use strict';

const axios = require('axios');
const ModelProviderBase = require('./ModelProviderBase');

/**
 * WebhookProvider
 *
 * Delegates chat completions to an external HTTP endpoint (e.g. an n8n
 * workflow).  The entire conversation is POSTed as JSON; the endpoint must
 * return a JSON body with at minimum a `content` (or `text` / `message`)
 * field containing the assistant reply.
 *
 * Request body sent to the webhook:
 * {
 *   "messages": [...],   // full conversation history
 *   "options": { ... },  // options passed by the caller
 *   "metadata": { ... }  // extra fields set at construction time
 * }
 *
 * Expected response shapes (first match wins):
 *   { "content": "..." }
 *   { "text": "..." }
 *   { "message": "..." }
 *   { "choices": [{ "message": { "content": "..." } }] }  // OpenAI-compatible
 */
class WebhookProvider extends ModelProviderBase {
  /**
   * @param {object} opts
   * @param {string} opts.url         - Webhook URL to POST to.
   * @param {string} [opts.name]      - Human-readable provider name.
   * @param {object} [opts.headers]   - Extra HTTP headers (e.g. auth tokens).
   * @param {object} [opts.metadata]  - Extra fields merged into every request body.
   * @param {number} [opts.timeout]   - Request timeout in milliseconds (default 30 s).
   */
  constructor(opts = {}) {
    super();
    if (!opts.url) throw new Error('WebhookProvider requires opts.url');
    this._url = opts.url;
    this._name = opts.name || `webhook:${opts.url}`;
    this._headers = opts.headers || {};
    this._metadata = opts.metadata || {};
    this._timeout = opts.timeout || 30000;
  }

  getName() {
    return this._name;
  }

  async getModels() {
    // Webhooks don't expose a model list; return a placeholder.
    return ['webhook-default'];
  }

  async chat(messages, options = {}) {
    const body = {
      messages,
      options,
      metadata: this._metadata,
    };

    const response = await axios.post(this._url, body, {
      headers: { 'Content-Type': 'application/json', ...this._headers },
      timeout: this._timeout,
    });

    const data = response.data;
    const content = this._extractContent(data);

    return {
      content,
      role: 'assistant',
      model: this._name,
      usage: data.usage || {},
      finishReason: data.finishReason || 'stop',
    };
  }

  /**
   * Streaming is not natively supported by arbitrary webhooks.
   * We fall back to a single request and yield the content in one chunk.
   */
  async *stream(messages, options = {}) {
    const result = await this.chat(messages, options);
    yield result.content;
  }

  _extractContent(data) {
    if (typeof data === 'string') return data;
    if (data.content) return data.content;
    if (data.text) return data.text;
    if (data.message) return data.message;
    if (Array.isArray(data.choices) && data.choices[0]?.message?.content) {
      return data.choices[0].message.content;
    }
    throw new Error(
      `WebhookProvider: could not extract content from response: ${JSON.stringify(data)}`
    );
  }
}

module.exports = WebhookProvider;
