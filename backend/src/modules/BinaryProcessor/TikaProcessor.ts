'use strict';

import axios from 'axios';
import BinaryProcessorBase, { ProcessResult } from './BinaryProcessorBase';
import config from '../../config';

interface TikaProcessorOpts {
  url?: string;
}

class TikaProcessor extends BinaryProcessorBase {
  private _url: string;

  constructor(opts: TikaProcessorOpts = {}) {
    super();
    this._url = opts.url ?? config.tika.url;
  }

  async process(buffer: Buffer, mimeType: string): Promise<ProcessResult> {
    const [text, metadata] = await Promise.all([
      this._extractText(buffer, mimeType),
      this._extractMeta(buffer, mimeType),
    ]);
    return { text, metadata };
  }

  private async _extractText(buffer: Buffer, mimeType: string): Promise<string> {
    const response = await axios.put<string | unknown>(`${this._url}/tika`, buffer, {
      headers: {
        'Content-Type': mimeType || 'application/octet-stream',
        Accept: 'text/plain',
      },
      maxBodyLength: Infinity,
    });
    return typeof response.data === 'string' ? response.data : String(response.data);
  }

  private async _extractMeta(buffer: Buffer, mimeType: string): Promise<Record<string, unknown>> {
    try {
      const response = await axios.put<Record<string, unknown>>(`${this._url}/meta`, buffer, {
        headers: {
          'Content-Type': mimeType || 'application/octet-stream',
          Accept: 'application/json',
        },
        maxBodyLength: Infinity,
      });
      return response.data ?? {};
    } catch {
      return {};
    }
  }
}

export default TikaProcessor;
