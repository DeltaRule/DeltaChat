'use strict';

export interface StoreResult {
  id: string;
  size: number;
  metadata: Record<string, unknown>;
}

export interface RetrieveResult {
  buffer: Buffer;
  metadata: Record<string, unknown>;
}

export interface DeleteResult {
  ok: boolean;
}

abstract class BinaryStorageBase {
  async store(_id: string, _buffer: Buffer, _metadata: Record<string, unknown>): Promise<StoreResult> {
    throw new Error(`${this.constructor.name} must implement store(id, buffer, metadata)`);
  }

  async retrieve(_id: string): Promise<RetrieveResult> {
    throw new Error(`${this.constructor.name} must implement retrieve(id)`);
  }

  async delete(_id: string): Promise<DeleteResult> {
    throw new Error(`${this.constructor.name} must implement delete(id)`);
  }

  async list(): Promise<StoreResult[]> {
    throw new Error(`${this.constructor.name} must implement list()`);
  }
}

export default BinaryStorageBase;
