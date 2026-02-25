'use strict';

const axios = require('axios');
const FormData = require('form-data');
const BinaryProcessorBase = require('./BinaryProcessorBase');
const config = require('../../config');

/**
 * DoclingProcessor
 *
 * Extracts text and metadata using the Docling HTTP API.
 * Docling (https://github.com/DS4SD/docling) must be running at the URL
 * configured via DOCLING_URL (default: http://localhost:5001).
 *
 * Expected Docling API:
 *   POST /convert    multipart/form-data with field "file"
 *   Response: { "text": "...", "metadata": { ... } }
 */
class DoclingProcessor extends BinaryProcessorBase {
  /**
   * @param {object} [opts]
   * @param {string} [opts.url] - Docling server base URL.
   */
  constructor(opts = {}) {
    super();
    this._url = opts.url || config.docling.url;
  }

  async process(buffer, mimeType) {
    const form = new FormData();
    form.append('file', buffer, {
      filename: 'document',
      contentType: mimeType || 'application/octet-stream',
    });

    const response = await axios.post(`${this._url}/convert`, form, {
      headers: {
        ...form.getHeaders(),
      },
      maxBodyLength: Infinity,
      timeout: 120000, // document conversion can be slow
    });

    const data = response.data || {};
    return {
      text: data.text || data.content || '',
      metadata: data.metadata || {},
    };
  }
}

module.exports = DoclingProcessor;
