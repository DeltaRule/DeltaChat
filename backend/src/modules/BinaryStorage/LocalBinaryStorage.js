'use strict';

const fs = require('fs');
const path = require('path');
const BinaryStorageBase = require('./BinaryStorageBase');
const config = require('../../config');

/**
 * LocalBinaryStorage
 *
 * Stores binary blobs on the local filesystem.
 * Each blob is saved as two files:
 *   <storageDir>/<id>        – raw binary data
 *   <storageDir>/<id>.meta   – JSON metadata sidecar
 */
class LocalBinaryStorage extends BinaryStorageBase {
  /**
   * @param {string} [storageDir] - Directory to store files in.
   *   Defaults to config.binaryStorage.path.
   */
  constructor(storageDir) {
    super();
    this.storageDir = storageDir || config.binaryStorage.path;
    this._ensureDir(this.storageDir);
  }

  _ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  _blobPath(id) {
    return path.join(this.storageDir, id);
  }

  _metaPath(id) {
    return path.join(this.storageDir, `${id}.meta`);
  }

  async store(id, buffer, metadata = {}) {
    if (!Buffer.isBuffer(buffer)) throw new TypeError('buffer must be a Buffer');
    fs.writeFileSync(this._blobPath(id), buffer);
    const meta = { ...metadata, id, size: buffer.length, storedAt: new Date().toISOString() };
    fs.writeFileSync(this._metaPath(id), JSON.stringify(meta, null, 2));
    return { id, size: buffer.length, metadata: meta };
  }

  async retrieve(id) {
    const blobPath = this._blobPath(id);
    if (!fs.existsSync(blobPath)) {
      const err = new Error(`Binary not found: ${id}`);
      err.status = 404;
      throw err;
    }
    const buffer = fs.readFileSync(blobPath);
    let metadata = {};
    if (fs.existsSync(this._metaPath(id))) {
      try {
        metadata = JSON.parse(fs.readFileSync(this._metaPath(id), 'utf8'));
      } catch {
        // corrupt meta – ignore
      }
    }
    return { buffer, metadata };
  }

  async delete(id) {
    const blobPath = this._blobPath(id);
    if (fs.existsSync(blobPath)) fs.unlinkSync(blobPath);
    const metaPath = this._metaPath(id);
    if (fs.existsSync(metaPath)) fs.unlinkSync(metaPath);
    return { ok: true };
  }

  async list() {
    const files = fs.readdirSync(this.storageDir);
    const results = [];
    for (const file of files) {
      if (file.endsWith('.meta')) continue;
      const metaPath = this._metaPath(file);
      let metadata = {};
      if (fs.existsSync(metaPath)) {
        try {
          metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
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

module.exports = LocalBinaryStorage;
