'use strict';

const { v4: uuidv4 } = require('uuid');
const { getAdapter } = require('../db/DeltaDatabaseAdapter');

// Lazy-loaded singletons
let _vectorStore = null;
let _embeddingProvider = null;
let _binaryProcessor = null;
let _binaryStorage = null;

function getVectorStore() {
  if (_vectorStore) return _vectorStore;
  const ChromaVectorStore = require('../modules/VectorStore/ChromaVectorStore');
  _vectorStore = new ChromaVectorStore();
  return _vectorStore;
}

function getEmbeddingProvider() {
  if (_embeddingProvider) return _embeddingProvider;
  const config = require('../config');
  if (config.openai.apiKey) {
    const OpenAIEmbedding = require('../modules/EmbeddingProvider/OpenAIEmbedding');
    _embeddingProvider = new OpenAIEmbedding();
  } else {
    const OllamaEmbedding = require('../modules/EmbeddingProvider/OllamaEmbedding');
    _embeddingProvider = new OllamaEmbedding();
  }
  return _embeddingProvider;
}

function getBinaryProcessor() {
  if (_binaryProcessor) return _binaryProcessor;
  const config = require('../config');
  // Prefer Tika if configured, otherwise fall through to Docling
  const TikaProcessor = require('../modules/BinaryProcessor/TikaProcessor');
  _binaryProcessor = new TikaProcessor({ url: config.tika.url });
  return _binaryProcessor;
}

function getBinaryStorage() {
  if (_binaryStorage) return _binaryStorage;
  const LocalBinaryStorage = require('../modules/BinaryStorage/LocalBinaryStorage');
  _binaryStorage = new LocalBinaryStorage();
  return _binaryStorage;
}

/** Split text into chunks of roughly `maxLen` characters with `overlap`. */
function chunkText(text, maxLen = 1000, overlap = 100) {
  const chunks = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + maxLen, text.length);
    chunks.push(text.slice(start, end));
    start += maxLen - overlap;
  }
  return chunks;
}

/**
 * KnowledgeService
 *
 * Manages knowledge stores, document ingestion (chunking + embedding),
 * and RAG retrieval.
 */
class KnowledgeService {
  constructor(opts = {}) {
    this._db = opts.db || getAdapter();
    this._getVectorStore = opts.getVectorStore || getVectorStore;
    this._getEmbedding = opts.getEmbeddingProvider || getEmbeddingProvider;
    this._getProcessor = opts.getBinaryProcessor || getBinaryProcessor;
    this._getStorage = opts.getBinaryStorage || getBinaryStorage;
  }

  // ── Knowledge Store CRUD ───────────────────────────────────────────────────

  async createKnowledgeStore(data = {}) {
    const ks = await this._db.createKnowledgeStore({
      id: uuidv4(),
      name: data.name || 'Unnamed Store',
      description: data.description || '',
      embeddingModel: data.embeddingModel || null,
      metadata: data.metadata || {},
    });

    // Create a corresponding ChromaDB collection
    try {
      const vs = this._getVectorStore();
      await vs.createCollection(ks.id);
    } catch (err) {
      console.error('[KnowledgeService] Could not create vector collection:', err.message);
    }

    return ks;
  }

  async listKnowledgeStores() {
    return this._db.listKnowledgeStores();
  }

  async getKnowledgeStore(id) {
    const ks = await this._db.getKnowledgeStore(id);
    if (!ks) {
      const err = new Error(`Knowledge store not found: ${id}`);
      err.status = 404;
      throw err;
    }
    return ks;
  }

  async deleteKnowledgeStore(id) {
    await this.getKnowledgeStore(id); // assert exists

    // Delete all documents in this store
    const docs = await this._db.listDocuments(id);
    for (const doc of docs) {
      await this._deleteDocumentVectors(id, doc.id);
      await this._db.deleteDocument(doc.id);
    }

    // Delete the vector collection
    try {
      const vs = this._getVectorStore();
      await vs.deleteCollection(id);
    } catch {
      // ignore – collection may not exist if ChromaDB was unavailable
    }

    return this._db.deleteKnowledgeStore(id);
  }

  // ── Document management ────────────────────────────────────────────────────

  /**
   * Ingest an uploaded document: store the binary, extract text, chunk,
   * embed, and upsert into the vector store.
   *
   * @param {string} knowledgeStoreId
   * @param {object} fileInfo   - { buffer, originalname, mimetype }
   * @returns {Promise<object>} Created document record
   */
  async addDocument(knowledgeStoreId, fileInfo) {
    await this.getKnowledgeStore(knowledgeStoreId); // assert exists

    const docId = uuidv4();

    // 1. Persist raw binary
    const storage = this._getStorage();
    await storage.store(docId, fileInfo.buffer, {
      originalname: fileInfo.originalname,
      mimeType: fileInfo.mimetype,
    });

    // 2. Extract text
    let extractedText = '';
    let processorMeta = {};
    try {
      const processor = this._getProcessor();
      const result = await processor.process(fileInfo.buffer, fileInfo.mimetype);
      extractedText = result.text || '';
      processorMeta = result.metadata || {};
    } catch (err) {
      console.error('[KnowledgeService] Text extraction failed:', err.message);
      extractedText = '';
    }

    // 3. Save document record
    const doc = await this._db.createDocument({
      id: docId,
      knowledgeStoreId,
      filename: fileInfo.originalname,
      mimeType: fileInfo.mimetype,
      size: fileInfo.buffer.length,
      chunkCount: 0,
      status: 'processing',
      processorMeta,
    });

    // 4. Chunk, embed, and upsert asynchronously
    this._indexDocument(knowledgeStoreId, docId, extractedText).catch((err) => {
      console.error(`[KnowledgeService] Indexing failed for doc ${docId}:`, err.message);
      this._db.updateDocument(docId, { status: 'error', errorMessage: err.message });
    });

    return doc;
  }

  async listDocuments(knowledgeStoreId) {
    return this._db.listDocuments(knowledgeStoreId);
  }

  async getDocument(knowledgeStoreId, docId) {
    const doc = await this._db.getDocument(docId);
    if (!doc || doc.knowledgeStoreId !== knowledgeStoreId) {
      const err = new Error(`Document not found: ${docId}`);
      err.status = 404;
      throw err;
    }
    return doc;
  }

  async deleteDocument(knowledgeStoreId, docId) {
    await this.getDocument(knowledgeStoreId, docId); // assert exists
    await this._deleteDocumentVectors(knowledgeStoreId, docId);

    // Delete binary
    try {
      const storage = this._getStorage();
      await storage.delete(docId);
    } catch {
      // ignore
    }

    return this._db.deleteDocument(docId);
  }

  // ── RAG retrieval ──────────────────────────────────────────────────────────

  /**
   * Retrieve the most relevant text chunks from one or more knowledge stores.
   *
   * @param {string}   query             - User query text.
   * @param {string[]} knowledgeStoreIds - Stores to search in.
   * @param {object}   [opts]
   * @param {number}   [opts.topK=5]
   * @returns {Promise<Array<{ id, text, score, docId, storeId }>>}
   */
  async retrieve(query, knowledgeStoreIds, opts = {}) {
    const topK = opts.topK || 5;

    const embedding = this._getEmbedding();
    const queryVector = await embedding.embed(query);

    const vs = this._getVectorStore();
    const allResults = [];

    for (const storeId of knowledgeStoreIds) {
      try {
        await vs.useCollection(storeId);
        const results = await vs.query(queryVector, topK);
        for (const r of results) {
          allResults.push({ ...r, storeId });
        }
      } catch (err) {
        console.error(`[KnowledgeService] Vector query failed for store ${storeId}:`, err.message);
      }
    }

    // Sort by score descending and return top K overall
    allResults.sort((a, b) => b.score - a.score);
    return allResults.slice(0, topK).map((r) => ({
      id: r.id,
      text: r.metadata.text || '',
      score: r.score,
      docId: r.metadata.docId,
      storeId: r.storeId,
    }));
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  async _indexDocument(knowledgeStoreId, docId, text) {
    if (!text.trim()) {
      await this._db.updateDocument(docId, { status: 'indexed', chunkCount: 0 });
      return;
    }

    const chunks = chunkText(text, 1000, 100);
    const embedding = this._getEmbedding();
    const vs = this._getVectorStore();

    // Ensure we write to the correct collection
    try {
      await vs.useCollection(knowledgeStoreId);
    } catch {
      await vs.createCollection(knowledgeStoreId);
    }

    // Embed in batches of 20
    const batchSize = 20;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const vectors = await embedding.embedBatch(batch);
      for (let j = 0; j < batch.length; j++) {
        const chunkId = `${docId}::${i + j}`;
        await vs.upsert(chunkId, vectors[j], {
          text: batch[j],
          docId,
          knowledgeStoreId,
          chunkIndex: i + j,
        });
      }
    }

    await this._db.updateDocument(docId, { status: 'indexed', chunkCount: chunks.length });
  }

  async _deleteDocumentVectors(knowledgeStoreId, docId) {
    try {
      const vs = this._getVectorStore();
      await vs.useCollection(knowledgeStoreId);
      const doc = await this._db.getDocument(docId);
      const chunkCount = doc?.chunkCount || 0;
      for (let i = 0; i < chunkCount; i++) {
        await vs.delete(`${docId}::${i}`);
      }
    } catch (err) {
      console.error('[KnowledgeService] Failed to delete vectors:', err.message);
    }
  }
}

module.exports = KnowledgeService;
