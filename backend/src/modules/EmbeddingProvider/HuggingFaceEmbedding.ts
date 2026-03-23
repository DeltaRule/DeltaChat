'use strict'

import axios, { AxiosInstance } from 'axios'
import EmbeddingProviderBase from './EmbeddingProviderBase'
import config from '../../config'

interface HuggingFaceEmbeddingOpts {
  apiKey?: string
  model?: string
  baseUrl?: string
  dimensions?: number
}

class HuggingFaceEmbedding extends EmbeddingProviderBase {
  private _http: AxiosInstance
  private _model: string
  private _dimensions: number

  constructor(opts: HuggingFaceEmbeddingOpts = {}) {
    super()
    const apiKey = opts.apiKey ?? config.huggingface.apiKey
    const baseUrl = opts.baseUrl ?? config.huggingface.baseUrl
    this._model = opts.model ?? 'sentence-transformers/all-MiniLM-L6-v2'
    this._dimensions = opts.dimensions ?? 384

    this._http = axios.create({
      baseURL: baseUrl,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      timeout: 60000,
    })
  }

  getDimensions(): number {
    return this._dimensions
  }

  async embed(text: string): Promise<number[]> {
    const result = await this.embedBatch([text])
    return result[0]
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const { data } = await this._http.post(`/pipeline/feature-extraction/${this._model}`, {
      inputs: texts,
    })
    // HuggingFace returns [[number[]]] for sentence-transformers
    // or [[number[][]]] for token-level embeddings. Handle both.
    if (Array.isArray(data) && Array.isArray(data[0])) {
      if (Array.isArray(data[0][0])) {
        // Token-level: mean-pool to sentence embedding
        return (data as number[][][]).map((tokenEmbeddings) => {
          const dim = tokenEmbeddings[0].length
          const mean = new Array<number>(dim).fill(0)
          for (const tok of tokenEmbeddings) {
            for (let i = 0; i < dim; i++) mean[i] += tok[i]
          }
          const len = tokenEmbeddings.length
          return mean.map((v) => v / len)
        })
      }
      // Already sentence-level
      return data as number[][]
    }
    return data as number[][]
  }
}

export default HuggingFaceEmbedding
