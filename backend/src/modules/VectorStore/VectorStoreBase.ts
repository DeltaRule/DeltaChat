'use strict';

export interface VectorResult {
  id: string;
  score: number;
  metadata: Record<string, unknown>;
}

abstract class VectorStoreBase {
  async upsert(_id: string, _vector: number[], _metadata: Record<string, unknown>): Promise<{ id: string }> {
    throw new Error(`${this.constructor.name} must implement upsert(id, vector, metadata)`);
  }

  async query(_vector: number[], _topK: number, _filter?: Record<string, unknown>): Promise<VectorResult[]> {
    throw new Error(`${this.constructor.name} must implement query(vector, topK, filter)`);
  }

  async delete(_id: string): Promise<{ ok: boolean }> {
    throw new Error(`${this.constructor.name} must implement delete(id)`);
  }

  async createCollection(_name: string): Promise<{ name: string }> {
    throw new Error(`${this.constructor.name} must implement createCollection(name)`);
  }

  async deleteCollection(_name: string): Promise<{ ok: boolean }> {
    throw new Error(`${this.constructor.name} must implement deleteCollection(name)`);
  }
}

export default VectorStoreBase;
