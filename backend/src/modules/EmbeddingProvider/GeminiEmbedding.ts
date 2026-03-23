'use strict'

import axios from 'axios'
import EmbeddingProviderBase from './EmbeddingProviderBase'
import config from '../../config'

interface GeminiEmbeddingOpts {
  apiKey?: string
  model?: string
  dimensions?: number
}

class GeminiEmbedding extends EmbeddingProviderBase {
  private _apiKey: string
  private _model: string
  private _dimensions: number

  constructor(opts: GeminiEmbeddingOpts = {}) {
    super()
    this._apiKey = opts.apiKey ?? config.gemini.apiKey
    this._model = opts.model ?? 'text-embedding-004'
    this._dimensions = opts.dimensions ?? 768
  }

  getDimensions(): number {
    return this._dimensions
  }

  async embed(text: string): Promise<number[]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this._model}:embedContent?key=${this._apiKey}`
    const { data } = await axios.post(url, {
      model: `models/${this._model}`,
      content: { parts: [{ text }] },
    })
    return data.embedding.values
  }

  async embedBatch(texts: string[]): Promise<number[][]> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${this._model}:batchEmbedContents?key=${this._apiKey}`
    const requests = texts.map((text) => ({
      model: `models/${this._model}`,
      content: { parts: [{ text }] },
    }))
    const { data } = await axios.post(url, { requests })
    return data.embeddings.map((e: { values: number[] }) => e.values)
  }
}

export default GeminiEmbedding
