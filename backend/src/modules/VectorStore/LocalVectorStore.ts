'use strict';

import fs from 'fs';
import path from 'path';
import VectorStoreBase, { VectorResult } from './VectorStoreBase';

interface StoredVector {
  id: string;
  vector: number[];
  metadata: Record<string, unknown>;
}

interface CollectionData {
  vectors: StoredVector[];
}

interface LocalVectorStoreOpts {
  dataDir?: string;
  defaultCollection?: string;
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i]! * b[i]!;
    normA += a[i]! * a[i]!;
    normB += b[i]! * b[i]!;
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

class LocalVectorStore extends VectorStoreBase {
  private _dataDir: string;
  private _collectionName: string;
  private _cache: Map<string, CollectionData>;

  constructor(opts: LocalVectorStoreOpts = {}) {
    super();
    this._dataDir = opts.dataDir ?? path.join(process.cwd(), 'data', 'vectorstore');
    this._collectionName = opts.defaultCollection ?? 'default';
    this._cache = new Map();
  }

  private _collectionPath(name: string): string {
    return path.join(this._dataDir, `${name}.json`);
  }

  private _loadCollection(name: string): CollectionData {
    const cached = this._cache.get(name);
    if (cached) return cached;

    const filePath = this._collectionPath(name);
    let data: CollectionData = { vectors: [] };
    if (fs.existsSync(filePath)) {
      try {
        const raw = fs.readFileSync(filePath, 'utf-8');
        data = JSON.parse(raw) as CollectionData;
      } catch {
        data = { vectors: [] };
      }
    }
    this._cache.set(name, data);
    return data;
  }

  private _saveCollection(name: string, data: CollectionData): void {
    fs.mkdirSync(this._dataDir, { recursive: true });
    fs.writeFileSync(this._collectionPath(name), JSON.stringify(data), 'utf-8');
    this._cache.set(name, data);
  }

  async upsert(id: string, vector: number[], metadata: Record<string, unknown> = {}): Promise<{ id: string }> {
    const data = this._loadCollection(this._collectionName);
    const idx = data.vectors.findIndex((v) => v.id === id);
    const entry: StoredVector = { id, vector, metadata };
    if (idx >= 0) {
      data.vectors[idx] = entry;
    } else {
      data.vectors.push(entry);
    }
    this._saveCollection(this._collectionName, data);
    return { id };
  }

  async query(vector: number[], topK = 5, filter?: Record<string, unknown>): Promise<VectorResult[]> {
    const data = this._loadCollection(this._collectionName);
    let candidates = data.vectors;

    if (filter && Object.keys(filter).length > 0) {
      candidates = candidates.filter((v) => {
        for (const [key, val] of Object.entries(filter)) {
          if (v.metadata[key] !== val) return false;
        }
        return true;
      });
    }

    const scored = candidates.map((v) => ({
      id: v.id,
      score: cosineSimilarity(vector, v.vector),
      metadata: v.metadata,
    }));

    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, topK);
  }

  async delete(id: string): Promise<{ ok: boolean }> {
    const data = this._loadCollection(this._collectionName);
    data.vectors = data.vectors.filter((v) => v.id !== id);
    this._saveCollection(this._collectionName, data);
    return { ok: true };
  }

  async createCollection(name: string): Promise<{ name: string }> {
    const data = this._loadCollection(name);
    this._saveCollection(name, data);
    return { name };
  }

  async deleteCollection(name: string): Promise<{ ok: boolean }> {
    const filePath = this._collectionPath(name);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
    this._cache.delete(name);
    return { ok: true };
  }

  async useCollection(name: string): Promise<void> {
    this._collectionName = name;
  }
}

export default LocalVectorStore;
