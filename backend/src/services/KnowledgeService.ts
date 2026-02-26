'use strict';

import { v4 as uuidv4 } from 'uuid';
import { getAdapter, DeltaDatabaseAdapter, Entity } from '../db/DeltaDatabaseAdapter';
import type EmbeddingProviderBase from '../modules/EmbeddingProvider/EmbeddingProviderBase';
import type VectorStoreBase from '../modules/VectorStore/VectorStoreBase';
import type BinaryProcessorBase from '../modules/BinaryProcessor/BinaryProcessorBase';
import type BinaryStorageBase from '../modules/BinaryStorage/BinaryStorageBase';

interface AppError extends Error {
  status?: number;
}

interface FileInfo {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

interface RetrieveOpts {
  topK?: number;
}

interface AllResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
  storeId: string;
}

interface RetrieveResult {
  id: string;
  text: string;
  score: number;
  docId: unknown;
  storeId: string;
}

interface KnowledgeServiceOpts {
  db?: DeltaDatabaseAdapter;
  getVectorStore?: () => VectorStoreBase;
  getEmbeddingProvider?: () => EmbeddingProviderBase;
  getBinaryProcessor?: () => BinaryProcessorBase;
  getBinaryStorage?: () => BinaryStorageBase;
}

// Lazy-loaded singletons
let _vectorStore: VectorStoreBase | null = null;
let _embeddingProvider: EmbeddingProviderBase | null = null;
let _binaryProcessor: BinaryProcessorBase | null = null;
let _binaryStorage: BinaryStorageBase | null = null;

function getVectorStore(): VectorStoreBase {
  if (_vectorStore) return _vectorStore;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const ChromaVectorStore = require('../modules/VectorStore/ChromaVectorStore').default as new () => VectorStoreBase;
  _vectorStore = new ChromaVectorStore();
  return _vectorStore;
}

function getEmbeddingProvider(): EmbeddingProviderBase {
  if (_embeddingProvider) return _embeddingProvider;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const config = require('../config').default as { openai: { apiKey: string } };
  if (config.openai.apiKey) {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const OpenAIEmbedding = require('../modules/EmbeddingProvider/OpenAIEmbedding').default as new () => EmbeddingProviderBase;
    _embeddingProvider = new OpenAIEmbedding();
  } else {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const OllamaEmbedding = require('../modules/EmbeddingProvider/OllamaEmbedding').default as new () => EmbeddingProviderBase;
    _embeddingProvider = new OllamaEmbedding();
  }
  return _embeddingProvider;
}

function getBinaryProcessor(): BinaryProcessorBase {
  if (_binaryProcessor) return _binaryProcessor;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const config = require('../config').default as { tika: { url: string } };
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const TikaProcessor = require('../modules/BinaryProcessor/TikaProcessor').default as new (opts: { url: string }) => BinaryProcessorBase;
  _binaryProcessor = new TikaProcessor({ url: config.tika.url });
  return _binaryProcessor;
}

function getBinaryStorage(): BinaryStorageBase {
  if (_binaryStorage) return _binaryStorage;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const LocalBinaryStorage = require('../modules/BinaryStorage/LocalBinaryStorage').default as new () => BinaryStorageBase;
  _binaryStorage = new LocalBinaryStorage();
  return _binaryStorage;
}

function chunkText(text: string, maxLen = 1000, overlap = 100): string[] {
  const chunks: string[] = [];
  let start = 0;
  while (start < text.length) {
    const end = Math.min(start + maxLen, text.length);
    chunks.push(text.slice(start, end));
    start += maxLen - overlap;
  }
  return chunks;
}

class KnowledgeService {
  private _db: DeltaDatabaseAdapter;
  private _getVectorStore: () => VectorStoreBase;
  private _getEmbedding: () => EmbeddingProviderBase;
  private _getProcessor: () => BinaryProcessorBase;
  private _getStorage: () => BinaryStorageBase;

  constructor(opts: KnowledgeServiceOpts = {}) {
    this._db = opts.db ?? getAdapter();
    this._getVectorStore = opts.getVectorStore ?? getVectorStore;
    this._getEmbedding = opts.getEmbeddingProvider ?? getEmbeddingProvider;
    this._getProcessor = opts.getBinaryProcessor ?? getBinaryProcessor;
    this._getStorage = opts.getBinaryStorage ?? getBinaryStorage;
  }

  // ── Knowledge Store CRUD ───────────────────────────────────────────────────

  async createKnowledgeStore(data: Record<string, unknown> = {}): Promise<Entity> {
    const ks = await this._db.createKnowledgeStore({
      id: uuidv4(),
      name: (data['name'] as string | undefined) ?? 'Unnamed Store',
      description: (data['description'] as string | undefined) ?? '',
      embeddingModel: (data['embeddingModel'] as string | null | undefined) ?? null,
      metadata: (data['metadata'] as Record<string, unknown> | undefined) ?? {},
    });

    try {
      const vs = this._getVectorStore();
      await vs.createCollection(ks.id);
    } catch (err) {
      console.error('[KnowledgeService] Could not create vector collection:', (err as Error).message);
    }

    return ks;
  }

  async listKnowledgeStores(): Promise<Entity[]> {
    return this._db.listKnowledgeStores();
  }

  async getKnowledgeStore(id: string): Promise<Entity> {
    const ks = await this._db.getKnowledgeStore(id);
    if (!ks) {
      const err: AppError = new Error(`Knowledge store not found: ${id}`);
      err.status = 404;
      throw err;
    }
    return ks;
  }

  async deleteKnowledgeStore(id: string): Promise<unknown> {
    await this.getKnowledgeStore(id);

    const docs = await this._db.listDocuments(id);
    for (const doc of docs) {
      await this._deleteDocumentVectors(id, doc.id);
      await this._db.deleteDocument(doc.id);
    }

    try {
      const vs = this._getVectorStore();
      await vs.deleteCollection(id);
    } catch {
      // ignore
    }

    return this._db.deleteKnowledgeStore(id);
  }

  // ── Document management ────────────────────────────────────────────────────

  async addDocument(knowledgeStoreId: string, fileInfo: FileInfo): Promise<Entity> {
    await this.getKnowledgeStore(knowledgeStoreId);

    const docId = uuidv4();

    const storage = this._getStorage();
    await storage.store(docId, fileInfo.buffer, {
      originalname: fileInfo.originalname,
      mimeType: fileInfo.mimetype,
    });

    let extractedText = '';
    let processorMeta: Record<string, unknown> = {};
    try {
      const processor = this._getProcessor();
      const result = await processor.process(fileInfo.buffer, fileInfo.mimetype);
      extractedText = result.text ?? '';
      processorMeta = result.metadata ?? {};
    } catch (err) {
      console.error('[KnowledgeService] Text extraction failed:', (err as Error).message);
      extractedText = '';
    }

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

    this._indexDocument(knowledgeStoreId, docId, extractedText).catch((err: Error) => {
      console.error(`[KnowledgeService] Indexing failed for doc ${docId}:`, err.message);
      this._db.updateDocument(docId, { status: 'error', errorMessage: err.message });
    });

    return doc;
  }

  async listDocuments(knowledgeStoreId: string): Promise<Entity[]> {
    return this._db.listDocuments(knowledgeStoreId);
  }

  async getDocument(knowledgeStoreId: string, docId: string): Promise<Entity> {
    const doc = await this._db.getDocument(docId);
    if (!doc || doc['knowledgeStoreId'] !== knowledgeStoreId) {
      const err: AppError = new Error(`Document not found: ${docId}`);
      err.status = 404;
      throw err;
    }
    return doc;
  }

  async deleteDocument(knowledgeStoreId: string, docId: string): Promise<unknown> {
    await this.getDocument(knowledgeStoreId, docId);
    await this._deleteDocumentVectors(knowledgeStoreId, docId);

    try {
      const storage = this._getStorage();
      await storage.delete(docId);
    } catch {
      // ignore
    }

    return this._db.deleteDocument(docId);
  }

  // ── RAG retrieval ──────────────────────────────────────────────────────────

  async retrieve(query: string, knowledgeStoreIds: string[], opts: RetrieveOpts = {}): Promise<RetrieveResult[]> {
    const topK = opts.topK ?? 5;

    const embedding = this._getEmbedding();
    const queryVector = await embedding.embed(query);

    const vs = this._getVectorStore();
    const allResults: AllResult[] = [];

    for (const storeId of knowledgeStoreIds) {
      try {
        // ChromaVectorStore has useCollection; call it via the base interface method by casting
        await (vs as unknown as { useCollection(name: string): Promise<unknown> }).useCollection(storeId);
        const results = await vs.query(queryVector, topK);
        for (const r of results) {
          allResults.push({ ...r, storeId });
        }
      } catch (err) {
        console.error(`[KnowledgeService] Vector query failed for store ${storeId}:`, (err as Error).message);
      }
    }

    allResults.sort((a, b) => b.score - a.score);
    return allResults.slice(0, topK).map((r) => ({
      id: r.id,
      text: (r.metadata['text'] as string | undefined) ?? '',
      score: r.score,
      docId: r.metadata['docId'],
      storeId: r.storeId,
    }));
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async _indexDocument(knowledgeStoreId: string, docId: string, text: string): Promise<void> {
    if (!text.trim()) {
      await this._db.updateDocument(docId, { status: 'indexed', chunkCount: 0 });
      return;
    }

    const chunks = chunkText(text, 1000, 100);
    const embedding = this._getEmbedding();
    const vs = this._getVectorStore();

    try {
      await (vs as unknown as { useCollection(name: string): Promise<unknown> }).useCollection(knowledgeStoreId);
    } catch {
      await vs.createCollection(knowledgeStoreId);
    }

    const batchSize = 20;
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize);
      const vectors = await embedding.embedBatch(batch);
      for (let j = 0; j < batch.length; j++) {
        const chunkId = `${docId}::${i + j}`;
        await vs.upsert(chunkId, vectors[j]!, {
          text: batch[j],
          docId,
          knowledgeStoreId,
          chunkIndex: i + j,
        });
      }
    }

    await this._db.updateDocument(docId, { status: 'indexed', chunkCount: chunks.length });
  }

  private async _deleteDocumentVectors(knowledgeStoreId: string, docId: string): Promise<void> {
    try {
      const vs = this._getVectorStore();
      await (vs as unknown as { useCollection(name: string): Promise<unknown> }).useCollection(knowledgeStoreId);
      const doc = await this._db.getDocument(docId);
      const chunkCount = (doc?.['chunkCount'] as number | undefined) ?? 0;
      for (let i = 0; i < chunkCount; i++) {
        await vs.delete(`${docId}::${i}`);
      }
    } catch (err) {
      console.error('[KnowledgeService] Failed to delete vectors:', (err as Error).message);
    }
  }
}

export default KnowledgeService;
