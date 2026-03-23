'use strict'

import axios, { AxiosInstance } from 'axios'
import EmbeddingProviderBase from './EmbeddingProviderBase'
import config from '../../config'

interface CohereEmbeddingOpts {
  apiKey?: string
  model?: string
  dimensions?: number
}

class CohereEmbedding extends EmbeddingProviderBase {
  private _http: AxiosInstance
  private _model: string
  private _dimensions: number

  constructor(opts: CohereEmbeddingOpts = {}) {
    super()
    const apiKey = opts.apiKey ?? config.cohere.apiKey
    this._http = axios.create({
      baseURL: 'https://api.cohere.com/v2',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    })
    this._model = opts.model ?? 'embed-english-v3.0'
    this._dimensions = opts.dimensions ?? 1024
  }

  getDimensions(): number {
    return this._dimensions
  }

  async embed(text: string): Promise<number[]> {
    const result = await this.embedBatch([text])
    return result[0]
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const { data } = await this._http.post('/embed', {
      model: this._model,
      texts,
      input_type: 'search_document',
      embedding_types: ['float'],
    })
    return data.embeddings.float
  }
}

export default CohereEmbedding
