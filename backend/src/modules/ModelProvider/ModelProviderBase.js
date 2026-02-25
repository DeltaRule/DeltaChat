'use strict';

/**
 * ModelProviderBase – abstract base class for all AI model providers.
 */
class ModelProviderBase {
  /**
   * Send a chat completion request (non-streaming).
   * @param {Array<{ role: string, content: string }>} messages
   * @param {object} [options] - Provider-specific options (model, temperature, …).
   * @returns {Promise<{ content: string, usage: object, model: string }>}
   */
  async chat(messages, options) {
    throw new Error(`${this.constructor.name} must implement chat(messages, options)`);
  }

  /**
   * Send a streaming chat completion request.
   * Yields string chunks via an async generator.
   * @param {Array<{ role: string, content: string }>} messages
   * @param {object} [options]
   * @returns {AsyncGenerator<string>}
   */
  async *stream(messages, options) {
    throw new Error(`${this.constructor.name} must implement stream(messages, options)`);
  }

  /**
   * Return the human-readable provider name.
   * @returns {string}
   */
  getName() {
    throw new Error(`${this.constructor.name} must implement getName()`);
  }

  /**
   * Return a list of available model identifiers for this provider.
   * @returns {Promise<string[]>}
   */
  async getModels() {
    throw new Error(`${this.constructor.name} must implement getModels()`);
  }
}

module.exports = ModelProviderBase;
