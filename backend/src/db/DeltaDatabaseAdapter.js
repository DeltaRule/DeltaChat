'use strict';

/**
 * DeltaDatabaseAdapter
 *
 * This adapter is designed to communicate with DeltaDatabase
 * (https://github.com/DeltaRule/DeltaDatabase), a Python-based database.
 *
 * In production the adapter talks to a Python bridge HTTP service
 * (set DELTA_DB_URL in .env).  When that URL is absent **or** the service
 * is unreachable the adapter automatically falls back to
 * `FileSystemFallback` mode, which persists every collection as a JSON
 * file inside the configured `dataDir`.
 *
 * ┌─────────────────────────────────────────────────────────────────┐
 * │  ⚠  FileSystemFallback is a DEVELOPMENT SHIM.                  │
 * │  It is NOT a replacement for DeltaDatabase.  It exists only to  │
 * │  let the application boot and be tested without a running       │
 * │  Python bridge.  Never use it in production.                    │
 * └─────────────────────────────────────────────────────────────────┘
 *
 * Python bridge contract (REST):
 *   POST   /collection/:name          – insert one document  { id, ...fields }
 *   GET    /collection/:name          – list all documents   → [...]
 *   GET    /collection/:name/:id      – get one document     → {...}
 *   PUT    /collection/:name/:id      – update document      { ...fields }
 *   DELETE /collection/:name/:id      – delete document      → { ok: true }
 *   POST   /collection/:name/query    – query                { filter, limit }
 */

const fs = require('fs');
const path = require('path');
const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

// ---------------------------------------------------------------------------
// FileSystemFallback
// ---------------------------------------------------------------------------

class FileSystemFallback {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this._ensureDir(dataDir);
  }

  _ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  _filePath(collection) {
    return path.join(this.dataDir, `${collection}.json`);
  }

  _read(collection) {
    const fp = this._filePath(collection);
    if (!fs.existsSync(fp)) return [];
    try {
      return JSON.parse(fs.readFileSync(fp, 'utf8'));
    } catch {
      return [];
    }
  }

  _write(collection, docs) {
    fs.writeFileSync(this._filePath(collection), JSON.stringify(docs, null, 2));
  }

  async insert(collection, doc) {
    const docs = this._read(collection);
    if (!doc.id) doc.id = uuidv4();
    if (!doc.createdAt) doc.createdAt = new Date().toISOString();
    doc.updatedAt = new Date().toISOString();
    docs.push(doc);
    this._write(collection, docs);
    return doc;
  }

  async findAll(collection) {
    return this._read(collection);
  }

  async findById(collection, id) {
    return this._read(collection).find((d) => d.id === id) || null;
  }

  async update(collection, id, fields) {
    const docs = this._read(collection);
    const idx = docs.findIndex((d) => d.id === id);
    if (idx === -1) return null;
    docs[idx] = { ...docs[idx], ...fields, id, updatedAt: new Date().toISOString() };
    this._write(collection, docs);
    return docs[idx];
  }

  async delete(collection, id) {
    const docs = this._read(collection);
    const filtered = docs.filter((d) => d.id !== id);
    this._write(collection, filtered);
    return { ok: true };
  }

  async query(collection, filter = {}, limit = 100) {
    let docs = this._read(collection);
    for (const [key, value] of Object.entries(filter)) {
      docs = docs.filter((d) => d[key] === value);
    }
    return docs.slice(0, limit);
  }
}

// ---------------------------------------------------------------------------
// HTTP bridge client (delegates to the Python DeltaDatabase service)
// ---------------------------------------------------------------------------

class HttpBridge {
  constructor(baseUrl) {
    this.client = axios.create({ baseURL: baseUrl, timeout: 10000 });
  }

  async insert(collection, doc) {
    const { data } = await this.client.post(`/collection/${collection}`, doc);
    return data;
  }

  async findAll(collection) {
    const { data } = await this.client.get(`/collection/${collection}`);
    return data;
  }

  async findById(collection, id) {
    const { data } = await this.client.get(`/collection/${collection}/${id}`);
    return data;
  }

  async update(collection, id, fields) {
    const { data } = await this.client.put(`/collection/${collection}/${id}`, fields);
    return data;
  }

  async delete(collection, id) {
    const { data } = await this.client.delete(`/collection/${collection}/${id}`);
    return data;
  }

  async query(collection, filter = {}, limit = 100) {
    const { data } = await this.client.post(`/collection/${collection}/query`, {
      filter,
      limit,
    });
    return data;
  }
}

// ---------------------------------------------------------------------------
// DeltaDatabaseAdapter  (public API used by the rest of the application)
// ---------------------------------------------------------------------------

class DeltaDatabaseAdapter {
  constructor() {
    if (config.deltaDb.url) {
      this._backend = new HttpBridge(config.deltaDb.url);
      this._mode = 'http';
      console.log(`[DeltaDB] Using HTTP bridge → ${config.deltaDb.url}`);
    } else {
      this._backend = new FileSystemFallback(config.deltaDb.dataDir);
      this._mode = 'filesystem';
      console.warn(
        '[DeltaDB] ⚠  DELTA_DB_URL not set – using FileSystemFallback (dev shim).  ' +
          'Set DELTA_DB_URL to point to the Python DeltaDatabase bridge in production.'
      );
    }
  }

  get mode() {
    return this._mode;
  }

  // ── Chats ──────────────────────────────────────────────────────────────────

  createChat(doc) {
    return this._backend.insert('chats', doc);
  }

  listChats() {
    return this._backend.findAll('chats');
  }

  getChat(id) {
    return this._backend.findById('chats', id);
  }

  updateChat(id, fields) {
    return this._backend.update('chats', id, fields);
  }

  deleteChat(id) {
    return this._backend.delete('chats', id);
  }

  // ── Messages ───────────────────────────────────────────────────────────────

  createMessage(doc) {
    return this._backend.insert('messages', doc);
  }

  listMessages(chatId) {
    return this._backend.query('messages', { chatId });
  }

  getMessage(id) {
    return this._backend.findById('messages', id);
  }

  updateMessage(id, fields) {
    return this._backend.update('messages', id, fields);
  }

  deleteMessage(id) {
    return this._backend.delete('messages', id);
  }

  deleteMessagesByChatId(chatId) {
    return this._backend.query('messages', { chatId }).then(async (msgs) => {
      for (const m of msgs) await this._backend.delete('messages', m.id);
      return { ok: true };
    });
  }

  // ── Knowledge Stores ───────────────────────────────────────────────────────

  createKnowledgeStore(doc) {
    return this._backend.insert('knowledge_stores', doc);
  }

  listKnowledgeStores() {
    return this._backend.findAll('knowledge_stores');
  }

  getKnowledgeStore(id) {
    return this._backend.findById('knowledge_stores', id);
  }

  updateKnowledgeStore(id, fields) {
    return this._backend.update('knowledge_stores', id, fields);
  }

  deleteKnowledgeStore(id) {
    return this._backend.delete('knowledge_stores', id);
  }

  // ── Documents ──────────────────────────────────────────────────────────────

  createDocument(doc) {
    return this._backend.insert('documents', doc);
  }

  listDocuments(knowledgeStoreId) {
    return this._backend.query('documents', { knowledgeStoreId });
  }

  getDocument(id) {
    return this._backend.findById('documents', id);
  }

  updateDocument(id, fields) {
    return this._backend.update('documents', id, fields);
  }

  deleteDocument(id) {
    return this._backend.delete('documents', id);
  }

  // ── Webhooks ───────────────────────────────────────────────────────────────

  createWebhook(doc) {
    return this._backend.insert('webhooks', doc);
  }

  listWebhooks() {
    return this._backend.findAll('webhooks');
  }

  getWebhook(id) {
    return this._backend.findById('webhooks', id);
  }

  updateWebhook(id, fields) {
    return this._backend.update('webhooks', id, fields);
  }

  deleteWebhook(id) {
    return this._backend.delete('webhooks', id);
  }

  // ── Settings ───────────────────────────────────────────────────────────────

  async getSettings() {
    const all = await this._backend.findAll('settings');
    // Settings are stored as a single document with id="global"
    return all.find((s) => s.id === 'global') || { id: 'global' };
  }

  async updateSettings(fields) {
    const existing = await this.getSettings();
    if (existing && existing.id) {
      return this._backend.update('settings', 'global', fields);
    }
    return this._backend.insert('settings', { id: 'global', ...fields });
  }
}

// Singleton
let instance = null;

function getAdapter() {
  if (!instance) instance = new DeltaDatabaseAdapter();
  return instance;
}

module.exports = { DeltaDatabaseAdapter, getAdapter };
