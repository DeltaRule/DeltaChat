'use strict';

/**
 * EmbeddingProviderBase – abstract base class for all embedding providers.
 */
class EmbeddingProviderBase {
  /**
   * Embed a single text string.
   * @param {string} text
   * @returns {Promise<number[]>} Embedding vector.
   */
  async embed(text) {
    throw new Error(`${this.constructor.name} must implement embed(text)`);
  }

  /**
   * Embed multiple texts in a single batch request.
   * @param {string[]} texts
   * @returns {Promise<number[][]>} Array of embedding vectors.
   */
  async embedBatch(texts) {
    throw new Error(`${this.constructor.name} must implement embedBatch(texts)`);
  }

  /**
   * Return the dimensionality of the vectors produced by this provider.
   * @returns {number}
   */
  getDimensions() {
    throw new Error(`${this.constructor.name} must implement getDimensions()`);
  }
}

module.exports = EmbeddingProviderBase;
