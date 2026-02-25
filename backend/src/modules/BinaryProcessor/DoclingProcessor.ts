'use strict';

import axios from 'axios';
import FormData from 'form-data';
import BinaryProcessorBase, { ProcessResult } from './BinaryProcessorBase';
import config from '../../config';

interface DoclingProcessorOpts {
  url?: string;
}

interface DoclingResponse {
  text?: string;
  content?: string;
  metadata?: Record<string, unknown>;
}

class DoclingProcessor extends BinaryProcessorBase {
  private _url: string;

  constructor(opts: DoclingProcessorOpts = {}) {
    super();
    this._url = opts.url ?? config.docling.url;
  }

  async process(buffer: Buffer, mimeType: string): Promise<ProcessResult> {
    const form = new FormData();
    form.append('file', buffer, {
      filename: 'document',
      contentType: mimeType || 'application/octet-stream',
    });

    const response = await axios.post<DoclingResponse>(`${this._url}/convert`, form, {
      headers: {
        ...form.getHeaders(),
      },
      maxBodyLength: Infinity,
      timeout: 120000,
    });

    const data = response.data ?? {};
    return {
      text: data.text ?? data.content ?? '',
      metadata: data.metadata ?? {},
    };
  }
}

export default DoclingProcessor;
