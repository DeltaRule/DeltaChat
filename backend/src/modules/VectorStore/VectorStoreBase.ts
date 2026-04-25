'use strict'

export interface VectorResult {
  id: string
  score: number
  metadata: Record<string, unknown>
}

abstract class VectorStoreBase {
  abstract upsert(
    id: string,
    vector: number[],
    metadata: Record<string, unknown>,
  ): Promise<{ id: string }>

  abstract query(
    vector: number[],
    topK: number,
    filter?: Record<string, unknown>,
  ): Promise<VectorResult[]>

  abstract delete(id: string): Promise<{ ok: boolean }>

  abstract createCollection(name: string): Promise<{ name: string }>

  abstract deleteCollection(name: string): Promise<{ ok: boolean }>

  /** Switch the active collection. Required for per-knowledge-store vector isolation. */
  abstract useCollection(name: string): Promise<void>
}

export default VectorStoreBase
