'use strict'

import VectorStoreBase from './VectorStoreBase'
import config from '../../config'

export interface VectorStoreConfig {
  type: 'local' | 'chroma' | 'pinecone' | 'qdrant' | 'weaviate' | 'milvus' | 'pgvector'
  url?: string
  path?: string
  collection?: string
  apiKey?: string
  connectionString?: string
  address?: string
  token?: string
}

const _instances = new Map<string, VectorStoreBase>()

function configKey(cfg: VectorStoreConfig): string {
  return JSON.stringify({ type: cfg.type, url: cfg.url, path: cfg.path })
}

export function createVectorStore(cfg: VectorStoreConfig): VectorStoreBase {
  const key = configKey(cfg)
  const cached = _instances.get(key)
  if (cached) return cached

  let instance: VectorStoreBase

  switch (cfg.type) {
    case 'chroma': {
      const ChromaVectorStore = require('./ChromaVectorStore').default as new (opts: {
        url?: string
        defaultCollection?: string
      }) => VectorStoreBase
      instance = new ChromaVectorStore({
        url: cfg.url ?? config.chroma.url,
        defaultCollection: cfg.collection ?? config.chroma.defaultCollection,
      })
      break
    }
    case 'pinecone': {
      const PineconeVectorStore = require('./PineconeVectorStore').default as new (opts: {
        apiKey?: string
        defaultCollection?: string
      }) => VectorStoreBase
      instance = new PineconeVectorStore({
        apiKey: cfg.apiKey ?? config.pinecone.apiKey,
        defaultCollection: cfg.collection,
      })
      break
    }
    case 'qdrant': {
      const QdrantVectorStore = require('./QdrantVectorStore').default as new (opts: {
        url?: string
        apiKey?: string
        defaultCollection?: string
      }) => VectorStoreBase
      instance = new QdrantVectorStore({
        url: cfg.url ?? config.qdrant.url,
        apiKey: cfg.apiKey ?? config.qdrant.apiKey,
        defaultCollection: cfg.collection,
      })
      break
    }
    case 'weaviate': {
      const WeaviateVectorStore = require('./WeaviateVectorStore').default as new (opts: {
        url?: string
        apiKey?: string
        defaultCollection?: string
      }) => VectorStoreBase
      instance = new WeaviateVectorStore({
        url: cfg.url ?? config.weaviate.url,
        apiKey: cfg.apiKey ?? config.weaviate.apiKey,
        defaultCollection: cfg.collection,
      })
      break
    }
    case 'milvus': {
      const MilvusVectorStore = require('./MilvusVectorStore').default as new (opts: {
        address?: string
        token?: string
        defaultCollection?: string
      }) => VectorStoreBase
      instance = new MilvusVectorStore({
        address: cfg.address ?? config.milvus.address,
        token: cfg.token ?? config.milvus.token,
        defaultCollection: cfg.collection,
      })
      break
    }
    case 'pgvector': {
      const PgVectorStore = require('./PgVectorStore').default as new (opts: {
        connectionString?: string
        defaultCollection?: string
      }) => VectorStoreBase
      instance = new PgVectorStore({
        connectionString: cfg.connectionString ?? config.pgvector.connectionString,
        defaultCollection: cfg.collection,
      })
      break
    }
    case 'local':
    default: {
      const LocalVectorStore = require('./LocalVectorStore').default as new (opts: {
        dataDir?: string
        defaultCollection?: string
      }) => VectorStoreBase
      instance = new LocalVectorStore({
        dataDir: cfg.path,
        defaultCollection: cfg.collection,
      })
      break
    }
  }

  _instances.set(key, instance)
  return instance
}

export function clearVectorStoreCache(): void {
  _instances.clear()
}
