'use strict'

import VectorStoreBase, { VectorResult } from './VectorStoreBase'
import config from '../../config'

interface PineconeVectorStoreOpts {
  apiKey?: string
  indexName?: string
  namespace?: string
}

class PineconeVectorStore extends VectorStoreBase {
  private _client: any = null
  private _apiKey: string
  private _indexName: string
  private _namespace: string

  constructor(opts: PineconeVectorStoreOpts = {}) {
    super()
    this._apiKey = opts.apiKey ?? config.pinecone.apiKey
    this._indexName = opts.indexName ?? config.pinecone.indexName
    this._namespace = opts.namespace ?? 'default'
  }

  private async _getIndex() {
    if (!this._client) {
      const { Pinecone } = require('@pinecone-database/pinecone') as any
      this._client = new Pinecone({ apiKey: this._apiKey })
    }
    return this._client.index(this._indexName)
  }

  async useCollection(name: string): Promise<void> {
    this._namespace = name
  }

  async upsert(
    id: string,
    vector: number[],
    metadata: Record<string, unknown>,
  ): Promise<{ id: string }> {
    const index = await this._getIndex()
    const ns = index.namespace(this._namespace)
    await ns.upsert([{ id, values: vector, metadata }])
    return { id }
  }

  async query(
    vector: number[],
    topK: number,
    filter?: Record<string, unknown>,
  ): Promise<VectorResult[]> {
    const index = await this._getIndex()
    const ns = index.namespace(this._namespace)
    const results = await ns.query({
      vector,
      topK,
      includeMetadata: true,
      ...(filter ? { filter } : {}),
    })
    return (results.matches ?? []).map((m: any) => ({
      id: m.id,
      score: m.score ?? 0,
      metadata: (m.metadata as Record<string, unknown>) ?? {},
    }))
  }

  async delete(id: string): Promise<{ ok: boolean }> {
    const index = await this._getIndex()
    const ns = index.namespace(this._namespace)
    await ns.deleteOne(id)
    return { ok: true }
  }

  async createCollection(name: string): Promise<{ name: string }> {
    // Pinecone uses namespaces within an index; no explicit creation needed
    this._namespace = name
    return { name }
  }

  async deleteCollection(name: string): Promise<{ ok: boolean }> {
    const index = await this._getIndex()
    const ns = index.namespace(name)
    await ns.deleteAll()
    return { ok: true }
  }
}

export default PineconeVectorStore
