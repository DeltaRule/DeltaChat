'use strict';

const axios = require('axios');
const FormData = require('form-data');
const BinaryProcessorBase = require('./BinaryProcessorBase');
const config = require('../../config');

/**
 * TikaProcessor
 *
 * Extracts text and metadata from files using the Apache Tika HTTP API.
 * Tika must be running at the URL configured via TIKA_URL (default:
 * http://localhost:9998).
 *
 * Relevant Tika endpoints used:
 *   PUT /tika        → returns plain text
 *   PUT /meta        → returns JSON metadata
 */
class TikaProcessor extends BinaryProcessorBase {
  /**
   * @param {object} [opts]
   * @param {string} [opts.url] - Tika server base URL.
   */
  constructor(opts = {}) {
    super();
    this._url = opts.url || config.tika.url;
  }

  async process(buffer, mimeType) {
    const [text, metadata] = await Promise.all([
      this._extractText(buffer, mimeType),
      this._extractMeta(buffer, mimeType),
    ]);
    return { text, metadata };
  }

  async _extractText(buffer, mimeType) {
    const response = await axios.put(`${this._url}/tika`, buffer, {
      headers: {
        'Content-Type': mimeType || 'application/octet-stream',
        Accept: 'text/plain',
      },
      maxBodyLength: Infinity,
    });
    return typeof response.data === 'string' ? response.data : String(response.data);
  }

  async _extractMeta(buffer, mimeType) {
    try {
      const response = await axios.put(`${this._url}/meta`, buffer, {
        headers: {
          'Content-Type': mimeType || 'application/octet-stream',
          Accept: 'application/json',
        },
        maxBodyLength: Infinity,
      });
      return response.data || {};
    } catch {
      return {};
    }
  }
}

module.exports = TikaProcessor;
