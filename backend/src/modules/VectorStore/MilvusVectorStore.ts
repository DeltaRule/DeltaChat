'use strict'

import VectorStoreBase, { VectorResult } from './VectorStoreBase'
import config from '../../config'

interface MilvusVectorStoreOpts {
  address?: string
  token?: string
  collectionName?: string
}

class MilvusVectorStore extends VectorStoreBase {
  private _client: any = null
  private _address: string
  private _token: string
  private _collectionName: string

  constructor(opts: MilvusVectorStoreOpts = {}) {
    super()
    this._address = opts.address ?? config.milvus.address
    this._token = opts.token ?? config.milvus.token
    this._collectionName = opts.collectionName ?? 'default'
  }

  private async _getClient() {
    if (!this._client) {
      const { MilvusClient } = require('@zilliz/milvus2-sdk-node') as any
      this._client = new MilvusClient({
        address: this._address,
        ...(this._token ? { token: this._token } : {}),
      })
    }
    return this._client
  }

  async useCollection(name: string): Promise<void> {
    this._collectionName = name.replace(/[^a-zA-Z0-9_]/g, '_')
  }

  async upsert(
    id: string,
    vector: number[],
    metadata: Record<string, unknown>,
  ): Promise<{ id: string }> {
    const client = await this._getClient()
    await client.upsert({
      collection_name: this._collectionName,
      data: [
        {
          id,
          vector,
          text: (metadata['text'] as string) ?? '',
          docId: (metadata['docId'] as string) ?? '',
          knowledgeStoreId: (metadata['knowledgeStoreId'] as string) ?? '',
          chunkIndex: (metadata['chunkIndex'] as number) ?? 0,
        },
      ],
    })
    return { id }
  }

  async query(
    vector: number[],
    topK: number,
    _filter?: Record<string, unknown>,
  ): Promise<VectorResult[]> {
    const client = await this._getClient()
    const results = await client.search({
      collection_name: this._collectionName,
      data: [vector],
      limit: topK,
      output_fields: ['text', 'docId', 'knowledgeStoreId', 'chunkIndex'],
    })
    return (results.results ?? []).map(
      (r: {
        id: string
        score: number
        text?: string
        docId?: string
        knowledgeStoreId?: string
        chunkIndex?: number
      }) => ({
        id: String(r.id),
        score: r.score,
        metadata: {
          text: r.text ?? '',
          docId: r.docId ?? '',
          knowledgeStoreId: r.knowledgeStoreId ?? '',
          chunkIndex: r.chunkIndex ?? 0,
        },
      }),
    )
  }

  async delete(id: string): Promise<{ ok: boolean }> {
    const client = await this._getClient()
    await client.delete({ collection_name: this._collectionName, ids: [id] })
    return { ok: true }
  }

  async createCollection(name: string): Promise<{ name: string }> {
    const collName = name.replace(/[^a-zA-Z0-9_]/g, '_')
    const client = await this._getClient()
    try {
      await client.createCollection({
        collection_name: collName,
        fields: [
          { name: 'id', data_type: 'VarChar', is_primary_key: true, max_length: 256 },
          { name: 'vector', data_type: 'FloatVector', dim: 1536 },
          { name: 'text', data_type: 'VarChar', max_length: 65535 },
          { name: 'docId', data_type: 'VarChar', max_length: 256 },
          { name: 'knowledgeStoreId', data_type: 'VarChar', max_length: 256 },
          { name: 'chunkIndex', data_type: 'Int32' },
        ],
      })
      await client.createIndex({
        collection_name: collName,
        field_name: 'vector',
        index_type: 'IVF_FLAT',
        metric_type: 'COSINE',
        params: { nlist: 128 },
      })
      await client.loadCollection({ collection_name: collName })
    } catch {
      // Collection may already exist
    }
    this._collectionName = collName
    return { name: collName }
  }

  async deleteCollection(name: string): Promise<{ ok: boolean }> {
    const collName = name.replace(/[^a-zA-Z0-9_]/g, '_')
    const client = await this._getClient()
    await client.dropCollection({ collection_name: collName })
    return { ok: true }
  }
}

export default MilvusVectorStore
