'use strict';

import fs from 'fs';
import path from 'path';
import BinaryStorageBase, { StoreResult, RetrieveResult, DeleteResult } from './BinaryStorageBase';
import config from '../../config';

interface StoredMeta extends Record<string, unknown> {
  id: string;
  size: number;
  storedAt: string;
}

interface AppError extends Error {
  status?: number;
}

class LocalBinaryStorage extends BinaryStorageBase {
  public storageDir: string;

  constructor(storageDir?: string) {
    super();
    this.storageDir = storageDir ?? config.binaryStorage.path;
    this._ensureDir(this.storageDir);
  }

  private _ensureDir(dir: string): void {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  private _blobPath(id: string): string {
    return path.join(this.storageDir, id);
  }

  private _metaPath(id: string): string {
    return path.join(this.storageDir, `${id}.meta`);
  }

  async store(id: string, buffer: Buffer, metadata: Record<string, unknown> = {}): Promise<StoreResult> {
    if (!Buffer.isBuffer(buffer)) throw new TypeError('buffer must be a Buffer');
    fs.writeFileSync(this._blobPath(id), buffer);
    const meta: StoredMeta = { ...metadata, id, size: buffer.length, storedAt: new Date().toISOString() };
    fs.writeFileSync(this._metaPath(id), JSON.stringify(meta, null, 2));
    return { id, size: buffer.length, metadata: meta };
  }

  async retrieve(id: string): Promise<RetrieveResult> {
    const blobPath = this._blobPath(id);
    if (!fs.existsSync(blobPath)) {
      const err: AppError = new Error(`Binary not found: ${id}`);
      err.status = 404;
      throw err;
    }
    const buffer = fs.readFileSync(blobPath);
    let metadata: Record<string, unknown> = {};
    if (fs.existsSync(this._metaPath(id))) {
      try {
        metadata = JSON.parse(fs.readFileSync(this._metaPath(id), 'utf8')) as Record<string, unknown>;
      } catch {
        // corrupt meta – ignore
      }
    }
    return { buffer, metadata };
  }

  async delete(id: string): Promise<DeleteResult> {
    const blobPath = this._blobPath(id);
    if (fs.existsSync(blobPath)) fs.unlinkSync(blobPath);
    const metaPath = this._metaPath(id);
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    return { ok: true };
  }

  async list(): Promise<StoreResult[]> {
    const files = fs.readdirSync(this.storageDir);
    const results: StoreResult[] = [];
    for (const file of files) {
      if (file.endsWith('.meta')) continue;
      const metaPath = this._metaPath(file);
      let metadata: Record<string, unknown> = {};
      if (fs.existsSync(metaPath)) {
        try {
          metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8')) as Record<string, unknown>;
        } catch {
          // ignore
        }
      }
      const stats = fs.statSync(path.join(this.storageDir, file));
      results.push({ id: file, size: stats.size, metadata });
    }
    return results;
  }
}

export default LocalBinaryStorage;
