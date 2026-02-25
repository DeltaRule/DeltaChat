'use strict';

const OpenAI = require('openai');
const EmbeddingProviderBase = require('./EmbeddingProviderBase');
const config = require('../../config');

/**
 * OpenAIEmbedding
 *
 * Uses the OpenAI Embeddings API (text-embedding-3-small by default).
 */
class OpenAIEmbedding extends EmbeddingProviderBase {
  /**
   * @param {object} [opts]
   * @param {string} [opts.apiKey]
   * @param {string} [opts.model]      - Embedding model id.
   * @param {number} [opts.dimensions] - Override output dimensions (for v3 models).
   */
  constructor(opts = {}) {
    super();
    this._client = new OpenAI({ apiKey: opts.apiKey || config.openai.apiKey });
    this._model = opts.model || 'text-embedding-3-small';
    this._dimensions = opts.dimensions || 1536;
  }

  getDimensions() {
    return this._dimensions;
  }

  async embed(text) {
    const response = await this._client.embeddings.create({
      model: this._model,
      input: text,
    });
    return response.data[0].embedding;
  }

  async embedBatch(texts) {
    const response = await this._client.embeddings.create({
      model: this._model,
      input: texts,
    });
    // Results are returned in the same order as input
    return response.data.map((d) => d.embedding);
  }
}

module.exports = OpenAIEmbedding;
