'use strict';

const { ChromaClient } = require('chromadb');
const VectorStoreBase = require('./VectorStoreBase');
const config = require('../../config');

/**
 * ChromaVectorStore
 *
 * Wraps ChromaDB (https://www.trychroma.com/) as a VectorStoreBase implementation.
 * Each "collection" in this adapter maps directly to a ChromaDB collection.
 */
class ChromaVectorStore extends VectorStoreBase {
  /**
   * @param {object} [opts]
   * @param {string} [opts.url]              - ChromaDB server URL.
   * @param {string} [opts.defaultCollection] - Active collection name.
   */
  constructor(opts = {}) {
    super();
    this.url = opts.url || config.chroma.url;
    this.collectionName = opts.defaultCollection || config.chroma.defaultCollection;
    this._client = new ChromaClient({ path: this.url });
    this._collection = null; // lazily initialised
  }

  async _getCollection() {
    if (!this._collection) {
      this._collection = await this._client.getOrCreateCollection({
        name: this.collectionName,
      });
    }
    return this._collection;
  }

  async upsert(id, vector, metadata = {}) {
    const col = await this._getCollection();
    await col.upsert({
      ids: [id],
      embeddings: [vector],
      metadatas: [metadata],
    });
    return { id };
  }

  async query(vector, topK = 5, filter = undefined) {
    const col = await this._getCollection();
    const queryParams = {
      queryEmbeddings: [vector],
      nResults: topK,
    };
    if (filter && Object.keys(filter).length > 0) {
      queryParams.where = filter;
    }
    const result = await col.query(queryParams);
    const ids = result.ids[0] || [];
    const distances = result.distances[0] || [];
    const metadatas = result.metadatas[0] || [];
    return ids.map((id, i) => ({
      id,
      score: 1 - (distances[i] || 0), // convert distance to similarity score
      metadata: metadatas[i] || {},
    }));
  }

  async delete(id) {
    const col = await this._getCollection();
    await col.delete({ ids: [id] });
    return { ok: true };
  }

  async createCollection(name) {
    const col = await this._client.getOrCreateCollection({ name });
    if (name === this.collectionName) this._collection = col;
    return { name };
  }

  async deleteCollection(name) {
    await this._client.deleteCollection({ name });
    if (name === this.collectionName) this._collection = null;
    return { ok: true };
  }

  /** Switch the active collection without recreating the client. */
  async useCollection(name) {
    this.collectionName = name;
    this._collection = null;
    return this._getCollection();
  }
}

module.exports = ChromaVectorStore;
