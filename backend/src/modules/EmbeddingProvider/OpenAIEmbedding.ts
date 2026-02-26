'use strict';

import OpenAI from 'openai';
import EmbeddingProviderBase from './EmbeddingProviderBase';
import config from '../../config';

interface OpenAIEmbeddingOpts {
  apiKey?: string;
  model?: string;
  dimensions?: number;
}

class OpenAIEmbedding extends EmbeddingProviderBase {
  private _client: OpenAI;
  private _model: string;
  private _dimensions: number;

  constructor(opts: OpenAIEmbeddingOpts = {}) {
    super();
    this._client = new OpenAI({ apiKey: opts.apiKey ?? config.openai.apiKey });
    this._model = opts.model ?? 'text-embedding-3-small';
    this._dimensions = opts.dimensions ?? 1536;
  }

  getDimensions(): number {
    return this._dimensions;
  }

  async embed(text: string): Promise<number[]> {
    const response = await this._client.embeddings.create({
      model: this._model,
      input: text,
    });
    return response.data[0].embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await this._client.embeddings.create({
      model: this._model,
      input: texts,
    });
    return response.data.map((d) => d.embedding);
  }
}

export default OpenAIEmbedding;
