'use strict';

const axios = require('axios');
const EmbeddingProviderBase = require('./EmbeddingProviderBase');
const config = require('../../config');

/**
 * OllamaEmbedding
 *
 * Generates embeddings using a locally running Ollama instance.
 * Calls the /api/embeddings endpoint.
 */
class OllamaEmbedding extends EmbeddingProviderBase {
  /**
   * @param {object} [opts]
   * @param {string} [opts.baseUrl]    - Ollama base URL (default from config).
   * @param {string} [opts.model]      - Model to use for embeddings.
   * @param {number} [opts.dimensions] - Expected vector dimensionality.
   */
  constructor(opts = {}) {
    super();
    this._baseUrl = opts.baseUrl || config.ollama.baseUrl;
    this._model = opts.model || 'nomic-embed-text';
    this._dimensions = opts.dimensions || 768; // nomic-embed-text default
  }

  getDimensions() {
    return this._dimensions;
  }

  async embed(text) {
    const response = await axios.post(`${this._baseUrl}/api/embeddings`, {
      model: this._model,
      prompt: text,
    });
    return response.data.embedding;
  }

  async embedBatch(texts) {
    // Ollama doesn't have a native batch endpoint; call sequentially
    const embeddings = [];
    for (const text of texts) {
      embeddings.push(await this.embed(text));
    }
    return embeddings;
  }
}

module.exports = OllamaEmbedding;
