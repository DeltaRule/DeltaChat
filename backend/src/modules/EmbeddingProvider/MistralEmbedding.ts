'use strict'

import OpenAI from 'openai'
import EmbeddingProviderBase from './EmbeddingProviderBase'
import config from '../../config'

interface MistralEmbeddingOpts {
  apiKey?: string
  model?: string
  dimensions?: number
}

class MistralEmbedding extends EmbeddingProviderBase {
  private _client: OpenAI
  private _model: string
  private _dimensions: number

  constructor(opts: MistralEmbeddingOpts = {}) {
    super()
    this._client = new OpenAI({
      apiKey: opts.apiKey ?? config.mistral.apiKey,
      baseURL: 'https://api.mistral.ai/v1',
    })
    this._model = opts.model ?? 'mistral-embed'
    this._dimensions = opts.dimensions ?? 1024
  }

  getDimensions(): number {
    return this._dimensions
  }

  async embed(text: string): Promise<number[]> {
    const response = await this._client.embeddings.create({
      model: this._model,
      input: text,
    })
    return response.data[0].embedding
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const response = await this._client.embeddings.create({
      model: this._model,
      input: texts,
    })
    return response.data.map((d) => d.embedding)
  }
}

export default MistralEmbedding
