'use strict';

import axios from 'axios';
import EmbeddingProviderBase from './EmbeddingProviderBase';
import config from '../../config';

interface OllamaEmbeddingOpts {
  baseUrl?: string;
  model?: string;
  dimensions?: number;
}

class OllamaEmbedding extends EmbeddingProviderBase {
  private _baseUrl: string;
  private _model: string;
  private _dimensions: number;

  constructor(opts: OllamaEmbeddingOpts = {}) {
    super();
    this._baseUrl = opts.baseUrl ?? config.ollama.baseUrl;
    this._model = opts.model ?? 'nomic-embed-text';
    this._dimensions = opts.dimensions ?? 768;
  }

  getDimensions(): number {
    return this._dimensions;
  }

  async embed(text: string): Promise<number[]> {
    const response = await axios.post<{ embedding: number[] }>(`${this._baseUrl}/api/embeddings`, {
      model: this._model,
      prompt: text,
    });
    return response.data.embedding;
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const embeddings: number[][] = [];
    for (const text of texts) {
      embeddings.push(await this.embed(text));
    }
    return embeddings;
  }
}

export default OllamaEmbedding;
