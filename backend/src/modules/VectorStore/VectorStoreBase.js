'use strict';

/**
 * VectorStoreBase – abstract base class for all vector store backends.
 */
class VectorStoreBase {
  /**
   * Upsert a vector into the store.
   * @param {string} id - Unique identifier.
   * @param {number[]} vector - Embedding vector.
   * @param {object} metadata - Arbitrary metadata to store alongside the vector.
   * @returns {Promise<{ id: string }>}
   */
  async upsert(id, vector, metadata) {
    throw new Error(`${this.constructor.name} must implement upsert(id, vector, metadata)`);
  }

  /**
   * Query the vector store for the top-k nearest neighbours.
   * @param {number[]} vector - Query vector.
   * @param {number} topK - Number of results to return.
   * @param {object} [filter] - Optional metadata filter.
   * @returns {Promise<Array<{ id: string, score: number, metadata: object }>>}
   */
  async query(vector, topK, filter) {
    throw new Error(`${this.constructor.name} must implement query(vector, topK, filter)`);
  }

  /**
   * Delete a vector by id.
   * @param {string} id
   * @returns {Promise<{ ok: boolean }>}
   */
  async delete(id) {
    throw new Error(`${this.constructor.name} must implement delete(id)`);
  }

  /**
   * Create a named collection (namespace) in the vector store.
   * @param {string} name
   * @returns {Promise<{ name: string }>}
   */
  async createCollection(name) {
    throw new Error(`${this.constructor.name} must implement createCollection(name)`);
  }

  /**
   * Delete a named collection.
   * @param {string} name
   * @returns {Promise<{ ok: boolean }>}
   */
  async deleteCollection(name) {
    throw new Error(`${this.constructor.name} must implement deleteCollection(name)`);
  }
}

module.exports = VectorStoreBase;
