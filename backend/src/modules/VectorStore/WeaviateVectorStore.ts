'use strict'

import axios, { AxiosInstance } from 'axios'
import VectorStoreBase, { VectorResult } from './VectorStoreBase'
import config from '../../config'

interface WeaviateVectorStoreOpts {
  url?: string
  apiKey?: string
  className?: string
}

class WeaviateVectorStore extends VectorStoreBase {
  private _http: AxiosInstance
  private _className: string

  constructor(opts: WeaviateVectorStoreOpts = {}) {
    super()
    const url = (opts.url ?? config.weaviate.url).replace(/\/$/, '')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (opts.apiKey ?? config.weaviate.apiKey) {
      headers['Authorization'] = `Bearer ${opts.apiKey ?? config.weaviate.apiKey}`
    }
    this._http = axios.create({ baseURL: url, headers, timeout: 30000 })
    this._className = opts.className ?? 'Default'
  }

  async useCollection(name: string): Promise<void> {
    // Capitalize first letter for Weaviate class naming convention
    this._className = name.charAt(0).toUpperCase() + name.slice(1).replace(/[^a-zA-Z0-9]/g, '_')
  }

  async upsert(
    id: string,
    vector: number[],
    metadata: Record<string, unknown>,
  ): Promise<{ id: string }> {
    try {
      await this._http.put(`/v1/objects/${this._className}/${id}`, {
        class: this._className,
        id,
        vector,
        properties: metadata,
      })
    } catch {
      await this._http.post('/v1/objects', {
        class: this._className,
        id,
        vector,
        properties: metadata,
      })
    }
    return { id }
  }

  async query(
    vector: number[],
    topK: number,
    _filter?: Record<string, unknown>,
  ): Promise<VectorResult[]> {
    const graphql = {
      query: `{
        Get {
          ${this._className}(
            nearVector: { vector: [${vector.join(',')}] }
            limit: ${topK}
          ) {
            _additional { id distance }
          }
        }
      }`,
    }
    const { data } = await this._http.post('/v1/graphql', graphql)
    const results = data?.data?.Get?.[this._className] ?? []
    return results.map((r: { _additional: { id: string; distance: number } }) => ({
      id: r._additional.id,
      score: 1 - (r._additional.distance ?? 0),
      metadata: {},
    }))
  }

  async delete(id: string): Promise<{ ok: boolean }> {
    await this._http.delete(`/v1/objects/${this._className}/${id}`)
    return { ok: true }
  }

  async createCollection(name: string): Promise<{ name: string }> {
    const className = name.charAt(0).toUpperCase() + name.slice(1).replace(/[^a-zA-Z0-9]/g, '_')
    try {
      await this._http.post('/v1/schema', {
        class: className,
        vectorizer: 'none',
        properties: [
          { name: 'text', dataType: ['text'] },
          { name: 'docId', dataType: ['text'] },
          { name: 'knowledgeStoreId', dataType: ['text'] },
          { name: 'chunkIndex', dataType: ['int'] },
        ],
      })
    } catch {
      // Class may already exist
    }
    this._className = className
    return { name: className }
  }

  async deleteCollection(name: string): Promise<{ ok: boolean }> {
    const className = name.charAt(0).toUpperCase() + name.slice(1).replace(/[^a-zA-Z0-9]/g, '_')
    await this._http.delete(`/v1/schema/${className}`)
    return { ok: true }
  }
}

export default WeaviateVectorStore
