'use strict';

/**
 * BinaryStorageBase – abstract base class for all binary storage backends.
 * Subclasses must override every method; calling an unimplemented method
 * throws a descriptive error rather than failing silently.
 */
class BinaryStorageBase {
  /**
   * Store a binary buffer under the given id.
   * @param {string} id - Unique identifier for the blob.
   * @param {Buffer} buffer - Raw binary data.
   * @param {object} metadata - Arbitrary metadata (mimeType, filename, …).
   * @returns {Promise<{ id: string, size: number, metadata: object }>}
   */
  async store(id, buffer, metadata) {
    throw new Error(`${this.constructor.name} must implement store(id, buffer, metadata)`);
  }

  /**
   * Retrieve a stored binary by id.
   * @param {string} id
   * @returns {Promise<{ buffer: Buffer, metadata: object }>}
   */
  async retrieve(id) {
    throw new Error(`${this.constructor.name} must implement retrieve(id)`);
  }

  /**
   * Delete a stored binary by id.
   * @param {string} id
   * @returns {Promise<{ ok: boolean }>}
   */
  async delete(id) {
    throw new Error(`${this.constructor.name} must implement delete(id)`);
  }

  /**
   * List all stored binaries.
   * @returns {Promise<Array<{ id: string, size: number, metadata: object }>>}
   */
  async list() {
    throw new Error(`${this.constructor.name} must implement list()`);
  }
}

module.exports = BinaryStorageBase;
