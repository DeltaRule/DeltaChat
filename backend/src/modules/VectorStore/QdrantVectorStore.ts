'use strict'

import axios, { AxiosInstance } from 'axios'
import VectorStoreBase, { VectorResult } from './VectorStoreBase'
import config from '../../config'

interface QdrantVectorStoreOpts {
  url?: string
  apiKey?: string
  collectionName?: string
}

class QdrantVectorStore extends VectorStoreBase {
  private _http: AxiosInstance
  private _collectionName: string

  constructor(opts: QdrantVectorStoreOpts = {}) {
    super()
    const url = (opts.url ?? config.qdrant.url).replace(/\/$/, '')
    const headers: Record<string, string> = { 'Content-Type': 'application/json' }
    if (opts.apiKey ?? config.qdrant.apiKey) {
      headers['api-key'] = opts.apiKey ?? config.qdrant.apiKey
    }
    this._http = axios.create({ baseURL: url, headers, timeout: 30000 })
    this._collectionName = opts.collectionName ?? 'default'
  }

  async useCollection(name: string): Promise<void> {
    this._collectionName = name
  }

  async upsert(
    id: string,
    vector: number[],
    metadata: Record<string, unknown>,
  ): Promise<{ id: string }> {
    await this._http.put(`/collections/${this._collectionName}/points`, {
      points: [{ id, vector, payload: metadata }],
    })
    return { id }
  }

  async query(
    vector: number[],
    topK: number,
    filter?: Record<string, unknown>,
  ): Promise<VectorResult[]> {
    const body: Record<string, unknown> = {
      vector,
      limit: topK,
      with_payload: true,
    }
    if (filter) body['filter'] = filter
    const { data } = await this._http.post(
      `/collections/${this._collectionName}/points/search`,
      body,
    )
    return (data.result ?? []).map(
      (r: { id: string; score: number; payload: Record<string, unknown> }) => ({
        id: String(r.id),
        score: r.score,
        metadata: r.payload ?? {},
      }),
    )
  }

  async delete(id: string): Promise<{ ok: boolean }> {
    await this._http.post(`/collections/${this._collectionName}/points/delete`, {
      points: [id],
    })
    return { ok: true }
  }

  async createCollection(name: string): Promise<{ name: string }> {
    try {
      await this._http.put(`/collections/${name}`, {
        vectors: { size: 1536, distance: 'Cosine' },
      })
    } catch {
      // Collection may already exist
    }
    this._collectionName = name
    return { name }
  }

  async deleteCollection(name: string): Promise<{ ok: boolean }> {
    await this._http.delete(`/collections/${name}`)
    return { ok: true }
  }
}

export default QdrantVectorStore
