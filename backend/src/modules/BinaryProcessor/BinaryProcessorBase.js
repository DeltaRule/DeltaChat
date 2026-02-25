'use strict';

/**
 * BinaryProcessorBase – abstract base class for document processors.
 *
 * A processor takes a raw binary buffer plus its MIME type and returns
 * extracted plain text together with structured metadata.
 */
class BinaryProcessorBase {
  /**
   * Process a binary buffer and extract text + metadata.
   * @param {Buffer} buffer   - Raw file content.
   * @param {string} mimeType - MIME type of the file (e.g. 'application/pdf').
   * @returns {Promise<{ text: string, metadata: object }>}
   */
  async process(buffer, mimeType) {
    throw new Error(`${this.constructor.name} must implement process(buffer, mimeType)`);
  }
}

module.exports = BinaryProcessorBase;
