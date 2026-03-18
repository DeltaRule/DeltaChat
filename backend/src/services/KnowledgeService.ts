'use strict'

import { randomUUID } from 'crypto'
import { getAdapter, DeltaDatabaseAdapter, Entity } from '../db/DeltaDatabaseAdapter'
import type EmbeddingProviderBase from '../modules/EmbeddingProvider/EmbeddingProviderBase'
import type VectorStoreBase from '../modules/VectorStore/VectorStoreBase'
import type BinaryProcessorBase from '../modules/BinaryProcessor/BinaryProcessorBase'
import type BinaryStorageBase from '../modules/BinaryStorage/BinaryStorageBase'
import { createVectorStore, VectorStoreConfig } from '../modules/VectorStore/VectorStoreFactory'
import {
  createBinaryProcessor,
  BinaryProcessorConfig,
} from '../modules/BinaryProcessor/BinaryProcessorFactory'
import logger from '../logger'

interface AppError extends Error {
  status?: number
}

interface FileInfo {
  buffer: Buffer
  originalname: string
  mimetype: string
}

interface RetrieveOpts {
  topK?: number
}

interface AllResult {
  id: string
  score: number
  metadata: Record<string, unknown>
  storeId: string
}

interface RetrieveResult {
  id: string
  text: string
  score: number
  docId: unknown
  storeId: string
}

interface KnowledgeServiceOpts {
  db?: DeltaDatabaseAdapter
  getBinaryStorage?: () => BinaryStorageBase
}

// Lazy-loaded binary storage singleton
let _binaryStorage: BinaryStorageBase | null = null

function getBinaryStorage(): BinaryStorageBase {
  if (_binaryStorage) return _binaryStorage

  const LocalBinaryStorage = require('../modules/BinaryStorage/LocalBinaryStorage')
    .default as new () => BinaryStorageBase
  _binaryStorage = new LocalBinaryStorage()
  return _binaryStorage
}

function chunkText(text: string, maxLen = 1000, overlap = 100): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    const end = Math.min(start + maxLen, text.length)
    chunks.push(text.slice(start, end))
    start += maxLen - overlap
  }
  return chunks
}

/**
 * Resolve an EmbeddingProvider from an ai_model entity of type "embedding".
 */
function createEmbeddingFromModel(model: Entity): EmbeddingProviderBase {
  const provider = model['provider'] as string | null
  const providerModel = model['providerModel'] as string | null

  switch (provider) {
    case 'openai': {
      const OpenAIEmbedding = require('../modules/EmbeddingProvider/OpenAIEmbedding')
        .default as new (opts: { model?: string }) => EmbeddingProviderBase
      return new OpenAIEmbedding({ model: providerModel ?? undefined })
    }
    case 'ollama':
    default: {
      const OllamaEmbedding = require('../modules/EmbeddingProvider/OllamaEmbedding')
        .default as new (opts: { model?: string }) => EmbeddingProviderBase
      return new OllamaEmbedding({ model: providerModel ?? undefined })
    }
  }
}

class KnowledgeService {
  private _db: DeltaDatabaseAdapter
  private _getStorage: () => BinaryStorageBase

  constructor(opts: KnowledgeServiceOpts = {}) {
    this._db = opts.db ?? getAdapter()
    this._getStorage = opts.getBinaryStorage ?? getBinaryStorage
  }

  /** Expose binary storage for download routes */
  getBinaryStorage(): BinaryStorageBase {
    return this._getStorage()
  }

  // ── Config resolution helpers ──────────────────────────────────────────────

  private async _getGlobalSettings(): Promise<Entity> {
    return this._db.getSettings()
  }

  private async _resolveVectorStore(ks: Entity): Promise<VectorStoreBase> {
    const storeConfig = (ks['vectorStoreConfig'] as VectorStoreConfig | null) ??
      ((await this._getGlobalSettings())[
        'defaultVectorStoreConfig'
      ] as VectorStoreConfig | null) ?? { type: 'local' as const }
    return createVectorStore(storeConfig)
  }

  private async _resolveEmbeddingProvider(ks: Entity): Promise<EmbeddingProviderBase> {
    const embeddingModelId =
      (ks['embeddingModelId'] as string | null) ??
      ((await this._getGlobalSettings())['defaultEmbeddingModelId'] as string | null)

    if (embeddingModelId) {
      const model = await this._db.getAiModel(embeddingModelId)
      if (model) return createEmbeddingFromModel(model)
    }

    // Fallback: use Ollama embedding by default

    const OllamaEmbedding = require('../modules/EmbeddingProvider/OllamaEmbedding')
      .default as new () => EmbeddingProviderBase
    return new OllamaEmbedding()
  }

  private async _resolveBinaryProcessor(ks: Entity): Promise<BinaryProcessorBase> {
    const procConfig = (ks['documentProcessorConfig'] as BinaryProcessorConfig | null) ??
      ((await this._getGlobalSettings())[
        'defaultDocumentProcessorConfig'
      ] as BinaryProcessorConfig | null) ?? { type: 'langchain' as const }
    return createBinaryProcessor(procConfig)
  }

  // ── Knowledge Store CRUD ───────────────────────────────────────────────────

  async createKnowledgeStore(data: Record<string, unknown> = {}): Promise<Entity> {
    const ks = await this._db.createKnowledgeStore({
      id: randomUUID(),
      name: (data['name'] as string | undefined) ?? 'Unnamed Store',
      description: (data['description'] as string | undefined) ?? '',
      embeddingModel: (data['embeddingModel'] as string | null | undefined) ?? null,
      embeddingModelId: (data['embeddingModelId'] as string | null | undefined) ?? null,
      vectorStoreConfig:
        (data['vectorStoreConfig'] as Record<string, unknown> | null | undefined) ?? null,
      documentProcessorConfig:
        (data['documentProcessorConfig'] as Record<string, unknown> | null | undefined) ?? null,
      chunkSize: (data['chunkSize'] as number | null | undefined) ?? null,
      chunkOverlap: (data['chunkOverlap'] as number | null | undefined) ?? null,
      chunkUnit: (data['chunkUnit'] as string | null | undefined) ?? null,
      metadata: (data['metadata'] as Record<string, unknown> | undefined) ?? {},
    })

    try {
      const vs = await this._resolveVectorStore(ks)
      await vs.createCollection(ks.id)
    } catch (err) {
      logger.error('[KnowledgeService] Could not create vector collection:', (err as Error).message)
    }

    return ks
  }

  async listKnowledgeStores(): Promise<Entity[]> {
    return this._db.listKnowledgeStores()
  }

  async getKnowledgeStore(id: string): Promise<Entity> {
    const ks = await this._db.getKnowledgeStore(id)
    if (!ks) {
      const err: AppError = new Error(`Knowledge store not found: ${id}`)
      err.status = 404
      throw err
    }
    return ks
  }

  async deleteKnowledgeStore(id: string): Promise<unknown> {
    const ks = await this.getKnowledgeStore(id)

    const docs = await this._db.listDocuments(id)
    for (const doc of docs) {
      await this._deleteDocumentVectors(ks, doc.id)
      await this._db.deleteDocument(doc.id)
    }

    try {
      const vs = await this._resolveVectorStore(ks)
      await vs.deleteCollection(id)
    } catch {
      // ignore
    }

    return this._db.deleteKnowledgeStore(id)
  }

  // ── Document management ────────────────────────────────────────────────────

  async addDocument(knowledgeStoreId: string, fileInfo: FileInfo): Promise<Entity> {
    const ks = await this.getKnowledgeStore(knowledgeStoreId)

    const docId = randomUUID()

    const storage = this._getStorage()
    await storage.store(docId, fileInfo.buffer, {
      originalname: fileInfo.originalname,
      mimeType: fileInfo.mimetype,
    })

    let extractedText = ''
    let processorMeta: Record<string, unknown> = {}
    try {
      const processor = await this._resolveBinaryProcessor(ks)
      const result = await processor.process(fileInfo.buffer, fileInfo.mimetype)
      extractedText = result.text ?? ''
      processorMeta = result.metadata ?? {}
    } catch (err) {
      logger.error('[KnowledgeService] Text extraction failed:', (err as Error).message)
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
    })

    this._indexDocument(ks, docId, extractedText).catch((err: Error) => {
      logger.error(`[KnowledgeService] Indexing failed for doc ${docId}:`, err.message)
      this._db.updateDocument(docId, { status: 'error', errorMessage: err.message })
    })

    return doc
  }

  async listDocuments(knowledgeStoreId: string): Promise<Entity[]> {
    return this._db.listDocuments(knowledgeStoreId)
  }

  async getDocument(knowledgeStoreId: string, docId: string): Promise<Entity> {
    const doc = await this._db.getDocument(docId)
    if (!doc || doc['knowledgeStoreId'] !== knowledgeStoreId) {
      const err: AppError = new Error(`Document not found: ${docId}`)
      err.status = 404
      throw err
    }
    return doc
  }

  async deleteDocument(knowledgeStoreId: string, docId: string): Promise<unknown> {
    await this.getDocument(knowledgeStoreId, docId)
    const ks = await this.getKnowledgeStore(knowledgeStoreId)
    await this._deleteDocumentVectors(ks, docId)

    try {
      const storage = this._getStorage()
      await storage.delete(docId)
    } catch {
      // ignore
    }

    return this._db.deleteDocument(docId)
  }

  // ── RAG retrieval ──────────────────────────────────────────────────────────

  async retrieve(
    query: string,
    knowledgeStoreIds: string[],
    opts: RetrieveOpts = {},
  ): Promise<RetrieveResult[]> {
    const topK = opts.topK ?? 5
    const allResults: AllResult[] = []

    for (const storeId of knowledgeStoreIds) {
      try {
        const ks = await this.getKnowledgeStore(storeId)
        const embedding = await this._resolveEmbeddingProvider(ks)
        const queryVector = await embedding.embed(query)
        const vs = await this._resolveVectorStore(ks)

        await (vs as unknown as { useCollection(name: string): Promise<unknown> }).useCollection(
          storeId,
        )
        const results = await vs.query(queryVector, topK)
        for (const r of results) {
          allResults.push({ ...r, storeId })
        }
      } catch (err) {
        logger.error(
          `[KnowledgeService] Vector query failed for store ${storeId}:`,
          (err as Error).message,
        )
      }
    }

    allResults.sort((a, b) => b.score - a.score)
    return allResults.slice(0, topK).map((r) => ({
      id: r.id,
      text: (r.metadata['text'] as string | undefined) ?? '',
      score: r.score,
      docId: r.metadata['docId'],
      storeId: r.storeId,
    }))
  }

  // ── Private helpers ────────────────────────────────────────────────────────

  private async _indexDocument(ks: Entity, docId: string, text: string): Promise<void> {
    if (!text.trim()) {
      await this._db.updateDocument(docId, { status: 'indexed', chunkCount: 0 })
      return
    }

    // Read chunk config from knowledge store, fallback to defaults
    const chunkSize = (ks['chunkSize'] as number | null) ?? 1000
    const chunkOverlap = (ks['chunkOverlap'] as number | null) ?? 100
    const chunkUnit = (ks['chunkUnit'] as string | null) ?? 'characters'

    let effectiveSize = chunkSize
    let effectiveOverlap = chunkOverlap
    if (chunkUnit === 'tokens') {
      // Approximate: 1 token ≈ 4 characters
      effectiveSize = chunkSize * 4
      effectiveOverlap = chunkOverlap * 4
    }

    const chunks = chunkText(text, effectiveSize, effectiveOverlap)
    const embedding = await this._resolveEmbeddingProvider(ks)
    const vs = await this._resolveVectorStore(ks)

    try {
      await (vs as unknown as { useCollection(name: string): Promise<unknown> }).useCollection(
        ks.id,
      )
    } catch {
      await vs.createCollection(ks.id)
    }

    const batchSize = 20
    for (let i = 0; i < chunks.length; i += batchSize) {
      const batch = chunks.slice(i, i + batchSize)
      const vectors = await embedding.embedBatch(batch)
      for (let j = 0; j < batch.length; j++) {
        const chunkId = `${docId}::${i + j}`
        await vs.upsert(chunkId, vectors[j]!, {
          text: batch[j],
          docId,
          knowledgeStoreId: ks.id,
          chunkIndex: i + j,
        })
      }
    }

    await this._db.updateDocument(docId, { status: 'indexed', chunkCount: chunks.length })
  }

  private async _deleteDocumentVectors(ks: Entity, docId: string): Promise<void> {
    try {
      const vs = await this._resolveVectorStore(ks)
      await (vs as unknown as { useCollection(name: string): Promise<unknown> }).useCollection(
        ks.id,
      )
      const doc = await this._db.getDocument(docId)
      const chunkCount = (doc?.['chunkCount'] as number | undefined) ?? 0
      for (let i = 0; i < chunkCount; i++) {
        await vs.delete(`${docId}::${i}`)
      }
    } catch (err) {
      logger.error('[KnowledgeService] Failed to delete vectors:', (err as Error).message)
    }
  }
}

export default KnowledgeService
