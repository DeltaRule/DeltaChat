'use strict';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { ChromaClient } = require('chromadb') as { ChromaClient: new (opts: { path: string }) => ChromaClientInstance };
import VectorStoreBase, { VectorResult } from './VectorStoreBase';
import config from '../../config';

interface ChromaClientInstance {
  getOrCreateCollection(opts: { name: string }): Promise<ChromaCollectionInstance>;
  deleteCollection(opts: { name: string }): Promise<void>;
}

interface ChromaQueryResult {
  ids: string[][];
  distances: number[][];
  metadatas: (Record<string, unknown> | null)[][];
}

interface ChromaCollectionInstance {
  upsert(opts: { ids: string[]; embeddings: number[][]; metadatas: Record<string, unknown>[] }): Promise<void>;
  query(opts: { queryEmbeddings: number[][]; nResults: number; where?: Record<string, unknown> }): Promise<ChromaQueryResult>;
  delete(opts: { ids: string[] }): Promise<void>;
}

interface ChromaVectorStoreOpts {
  url?: string;
  defaultCollection?: string;
}

class ChromaVectorStore extends VectorStoreBase {
  public url: string;
  public collectionName: string;
  private _client: ChromaClientInstance;
  private _collection: ChromaCollectionInstance | null;

  constructor(opts: ChromaVectorStoreOpts = {}) {
    super();
    this.url = opts.url ?? config.chroma.url;
    this.collectionName = opts.defaultCollection ?? config.chroma.defaultCollection;
    this._client = new ChromaClient({ path: this.url });
    this._collection = null;
  }

  private async _getCollection(): Promise<ChromaCollectionInstance> {
    if (!this._collection) {
      this._collection = await this._client.getOrCreateCollection({
        name: this.collectionName,
      });
    }
    return this._collection;
  }

  async upsert(id: string, vector: number[], metadata: Record<string, unknown> = {}): Promise<{ id: string }> {
    const col = await this._getCollection();
    await col.upsert({
      ids: [id],
      embeddings: [vector],
      metadatas: [metadata],
    });
    return { id };
  }

  async query(vector: number[], topK = 5, filter?: Record<string, unknown>): Promise<VectorResult[]> {
    const col = await this._getCollection();
    const queryParams: { queryEmbeddings: number[][]; nResults: number; where?: Record<string, unknown> } = {
      queryEmbeddings: [vector],
      nResults: topK,
    };
    if (filter && Object.keys(filter).length > 0) {
      queryParams.where = filter;
    }
    const result = await col.query(queryParams);
    const ids = result.ids[0] ?? [];
    const distances = result.distances[0] ?? [];
    const metadatas = result.metadatas[0] ?? [];
    return ids.map((id, i) => ({
      id,
      score: 1 - (distances[i] ?? 0),
      metadata: (metadatas[i] ?? {}) as Record<string, unknown>,
    }));
  }

  async delete(id: string): Promise<{ ok: boolean }> {
    const col = await this._getCollection();
    await col.delete({ ids: [id] });
    return { ok: true };
  }

  async createCollection(name: string): Promise<{ name: string }> {
    const col = await this._client.getOrCreateCollection({ name });
    if (name === this.collectionName) this._collection = col;
    return { name };
  }

  async deleteCollection(name: string): Promise<{ ok: boolean }> {
    await this._client.deleteCollection({ name });
    if (name === this.collectionName) this._collection = null;
    return { ok: true };
  }

  async useCollection(name: string): Promise<ChromaCollectionInstance> {
    this.collectionName = name;
    this._collection = null;
    return this._getCollection();
  }
}

export default ChromaVectorStore;
