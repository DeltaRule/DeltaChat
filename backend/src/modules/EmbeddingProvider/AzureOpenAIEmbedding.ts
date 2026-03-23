'use strict'

import { AzureOpenAI } from 'openai'
import EmbeddingProviderBase from './EmbeddingProviderBase'
import config from '../../config'

interface AzureOpenAIEmbeddingOpts {
  apiKey?: string
  baseUrl?: string
  model?: string
  dimensions?: number
  apiVersion?: string
}

class AzureOpenAIEmbedding extends EmbeddingProviderBase {
  private _client: AzureOpenAI
  private _model: string
  private _dimensions: number

  constructor(opts: AzureOpenAIEmbeddingOpts = {}) {
    super()
    this._client = new AzureOpenAI({
      apiKey: opts.apiKey ?? config.azureOpenai.apiKey,
      endpoint: opts.baseUrl ?? config.azureOpenai.endpoint,
      apiVersion: opts.apiVersion ?? config.azureOpenai.apiVersion,
    })
    this._model = opts.model ?? 'text-embedding-ada-002'
    this._dimensions = opts.dimensions ?? 1536
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

export default AzureOpenAIEmbedding
