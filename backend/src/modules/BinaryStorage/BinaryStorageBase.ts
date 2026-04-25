'use strict'

export interface StoreResult {
  id: string
  size: number
  metadata: Record<string, unknown>
}

export interface RetrieveResult {
  buffer: Buffer
  metadata: Record<string, unknown>
}

export interface DeleteResult {
  ok: boolean
}

abstract class BinaryStorageBase {
  abstract store(
    id: string,
    buffer: Buffer,
    metadata: Record<string, unknown>,
  ): Promise<StoreResult>

  abstract retrieve(id: string): Promise<RetrieveResult>

  abstract delete(id: string): Promise<DeleteResult>

  abstract list(): Promise<StoreResult[]>
}

export default BinaryStorageBase
