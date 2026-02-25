'use strict';

/**
 * DeltaDatabaseAdapter
 *
 * Wraps the DeltaDatabase REST API (https://github.com/DeltaRule/DeltaDatabase).
 * Run DeltaDatabase with Docker:
 *
 *   docker run -d -p 8080:8080 -e ADMIN_KEY=mysecretadminkey -v delta_data:/shared/db \
 *     donti/deltadatabase:latest-aio
 *
 * Configure via environment variables (all required):
 *   DELTA_DB_URL        Base URL of the DeltaDatabase instance  (e.g. http://127.0.0.1:8080)
 *   DELTA_DB_ADMIN_KEY  Admin key for authentication            (matches ADMIN_KEY in container)
 *   DELTA_DB_DATABASE   Database (namespace) name               (default: deltachat)
 *
 * ── Storage design ───────────────────────────────────────────────────────────
 * DeltaDatabase stores entities as key → JSON document pairs inside a named
 * database.  There is no built-in "list all" or "delete" operation, so this
 * adapter maintains explicit index documents:
 *
 *   Key pattern                   Purpose
 *   ──────────────────────────    ────────────────────────────────────────────
 *   {col}:{id}                    The entity itself
 *   {col}:_index                  Master list of all non-deleted IDs
 *   {col}:_idx:{field}:{value}    Secondary index: IDs where doc[field]===value
 *
 * Deletions are soft: the entity is marked { _deleted: true } and its ID is
 * pruned from every index it appeared in.
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const { validate } = require('./schema');

const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000; // refresh 5 min before expiry

// ── DeltaDatabaseClient ───────────────────────────────────────────────────────

class DeltaDatabaseClient {
  constructor(baseUrl, adminKey, database) {
    this.baseUrl  = baseUrl.replace(/\/$/, '');
    this.adminKey = adminKey || null;
    this.database = database || 'deltachat';
    this._token       = null;
    this._tokenExpiry = null;
    this._http = axios.create({ baseURL: this.baseUrl, timeout: 15000 });
  }

  // ── Auth ────────────────────────────────────────────────────────────────────

  async _ensureToken() {
    const needsRefresh =
      !this._token ||
      (this._tokenExpiry && Date.now() > this._tokenExpiry - TOKEN_REFRESH_MARGIN_MS);

    if (needsRefresh) {
      const body = this.adminKey ? { key: this.adminKey } : { client_id: 'deltachat' };
      const { data } = await this._http.post('/api/login', body);
      this._token       = data.token;
      this._tokenExpiry = data.expires_at ? new Date(data.expires_at).getTime() : null;
    }
    return this._token;
  }

  async _authHeader() {
    return { Authorization: `Bearer ${await this._ensureToken()}` };
  }

  // ── DeltaDatabase REST helpers ────────────────────────────────────────────────

  /** PUT /entity/{db}  { key: doc, … }  – upsert one or more entities. */
  async _put(entities) {
    const headers = await this._authHeader();
    try {
      await this._http.put(`/entity/${this.database}`, entities, { headers });
    } catch (err) {
      if (err.response && err.response.status === 401) {
        this._token = null;
        const h = await this._authHeader();
        await this._http.put(`/entity/${this.database}`, entities, { headers: h });
      } else {
        throw err;
      }
    }
  }

  /** GET /entity/{db}?key={k}  – fetch one entity; returns null on 404. */
  async _get(key) {
    const headers = await this._authHeader();
    try {
      const { data } = await this._http.get(`/entity/${this.database}`, {
        params: { key },
        headers,
      });
      return data;
    } catch (err) {
      if (err.response && err.response.status === 404) return null;
      if (err.response && err.response.status === 401) {
        this._token = null;
        const h = await this._authHeader();
        const { data } = await this._http.get(`/entity/${this.database}`, {
          params: { key },
          headers: h,
        });
        return data;
      }
      throw err;
    }
  }

  // ── Index helpers ─────────────────────────────────────────────────────────────

  async _readIndex(collection) {
    return (await this._get(`${collection}:_index`)) || { keys: [] };
  }

  async _addToIndex(collection, id) {
    const idx = await this._readIndex(collection);
    if (!idx.keys.includes(id)) {
      idx.keys.push(id);
      await this._put({ [`${collection}:_index`]: idx });
    }
  }

  async _removeFromIndex(collection, id) {
    const idx = await this._readIndex(collection);
    const before = idx.keys.length;
    idx.keys = idx.keys.filter((k) => k !== id);
    if (idx.keys.length !== before) {
      await this._put({ [`${collection}:_index`]: idx });
    }
  }

  async _addToSecondaryIndex(collection, field, value, id) {
    const key = `${collection}:_idx:${field}:${value}`;
    const idx = (await this._get(key)) || { keys: [] };
    if (!idx.keys.includes(id)) {
      idx.keys.push(id);
      await this._put({ [key]: idx });
    }
  }

  async _removeFromSecondaryIndex(collection, field, value, id) {
    const key = `${collection}:_idx:${field}:${value}`;
    const idx = (await this._get(key)) || { keys: [] };
    const before = idx.keys.length;
    idx.keys = idx.keys.filter((k) => k !== id);
    if (idx.keys.length !== before) {
      await this._put({ [key]: idx });
    }
  }

  // ── CRUD ──────────────────────────────────────────────────────────────────────

  async insert(collection, doc, secondaryIndexFields = []) {
    const now = new Date().toISOString();
    const id  = doc.id || uuidv4();
    const entity = { ...doc, id, createdAt: doc.createdAt || now, updatedAt: now };

    validate(collection, entity);

    await this._put({ [`${collection}:${id}`]: entity });
    await this._addToIndex(collection, id);

    for (const field of secondaryIndexFields) {
      if (entity[field] !== undefined) {
        await this._addToSecondaryIndex(collection, field, entity[field], id);
      }
    }
    return entity;
  }

  async findAll(collection) {
    const idx = await this._readIndex(collection);
    if (!idx.keys.length) return [];
    const docs = await Promise.all(idx.keys.map((id) => this._get(`${collection}:${id}`)));
    return docs.filter((d) => d && !d._deleted);
  }

  async findById(collection, id) {
    const doc = await this._get(`${collection}:${id}`);
    return doc && !doc._deleted ? doc : null;
  }

  async update(collection, id, fields) {
    const existing = await this.findById(collection, id);
    if (!existing) return null;
    const updated = {
      ...existing,
      ...fields,
      id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    await this._put({ [`${collection}:${id}`]: updated });
    return updated;
  }

  /**
   * @param {string}   collection
   * @param {string}   id
   * @param {Array<{field:string,value:any}>} [secondaryIndexes]  indexes to prune
   */
  async delete(collection, id, secondaryIndexes = []) {
    const existing = await this.findById(collection, id);
    if (!existing) return { ok: false };

    await this._put({
      [`${collection}:${id}`]: {
        ...existing,
        _deleted: true,
        updatedAt: new Date().toISOString(),
      },
    });
    await this._removeFromIndex(collection, id);

    for (const { field, value } of secondaryIndexes) {
      await this._removeFromSecondaryIndex(collection, field, value, id);
    }
    return { ok: true };
  }

  async query(collection, filter = {}, limit = 100) {
    const filterEntries = Object.entries(filter);
    if (!filterEntries.length) return this.findAll(collection);

    // Try secondary index for the first filter field
    const [field, value] = filterEntries[0];
    const idxKey = `${collection}:_idx:${field}:${value}`;
    const idx    = (await this._get(idxKey)) || { keys: [] };

    let docs;
    if (idx.keys.length > 0) {
      const fetched = await Promise.all(
        idx.keys.map((id) => this._get(`${collection}:${id}`))
      );
      docs = fetched.filter((d) => d && !d._deleted);
    } else {
      docs = await this.findAll(collection);
    }

    // Apply remaining filters in-memory
    for (const [k, v] of filterEntries.slice(1)) {
      docs = docs.filter((d) => d[k] === v);
    }

    return docs.slice(0, limit);
  }
}

// ── DeltaDatabaseAdapter ──────────────────────────────────────────────────────

class DeltaDatabaseAdapter {
  constructor() {
    if (!config.deltaDb.url) {
      throw new Error(
        '[DeltaDB] DELTA_DB_URL is required. Start DeltaDatabase with:\n' +
        '  docker run -d -p 8080:8080 -e ADMIN_KEY=mysecretadminkey -v delta_data:/shared/db \\\n' +
        '    donti/deltadatabase:latest-aio\n' +
        '  Then set DELTA_DB_URL=http://127.0.0.1:8080 and DELTA_DB_ADMIN_KEY=mysecretadminkey'
      );
    }
    this._backend = new DeltaDatabaseClient(
      config.deltaDb.url,
      config.deltaDb.adminKey,
      config.deltaDb.database
    );
    console.log(
      `[DeltaDB] Connected to DeltaDatabase at ${config.deltaDb.url}` +
      ` (database: "${config.deltaDb.database}")`
    );
  }

  get mode() { return 'deltadatabase'; }

  // ── Chats ───────────────────────────────────────────────────────────────────

  createChat(doc)          { return this._backend.insert('chats', doc); }
  listChats()              { return this._backend.findAll('chats'); }
  getChat(id)              { return this._backend.findById('chats', id); }
  updateChat(id, fields)   { return this._backend.update('chats', id, fields); }
  deleteChat(id)           { return this._backend.delete('chats', id); }

  // ── Messages ────────────────────────────────────────────────────────────────

  createMessage(doc) {
    return this._backend.insert('messages', doc, ['chatId']);
  }

  listMessages(chatId) {
    return this._backend.query('messages', { chatId });
  }

  getMessage(id)             { return this._backend.findById('messages', id); }
  updateMessage(id, fields)  { return this._backend.update('messages', id, fields); }

  async deleteMessage(id) {
    const msg = await this._backend.findById('messages', id);
    return this._backend.delete(
      'messages', id,
      msg ? [{ field: 'chatId', value: msg.chatId }] : []
    );
  }

  async deleteMessagesByChatId(chatId) {
    const msgs = await this.listMessages(chatId);
    for (const m of msgs) {
      await this._backend.delete('messages', m.id, [{ field: 'chatId', value: chatId }]);
    }
    return { ok: true };
  }

  // ── Knowledge Stores ────────────────────────────────────────────────────────

  createKnowledgeStore(doc)        { return this._backend.insert('knowledge_stores', doc); }
  listKnowledgeStores()            { return this._backend.findAll('knowledge_stores'); }
  getKnowledgeStore(id)            { return this._backend.findById('knowledge_stores', id); }
  updateKnowledgeStore(id, fields) { return this._backend.update('knowledge_stores', id, fields); }
  deleteKnowledgeStore(id)         { return this._backend.delete('knowledge_stores', id); }

  // ── Documents ───────────────────────────────────────────────────────────────

  createDocument(doc) {
    return this._backend.insert('documents', doc, ['knowledgeStoreId']);
  }

  listDocuments(knowledgeStoreId) {
    return this._backend.query('documents', { knowledgeStoreId });
  }

  getDocument(id)             { return this._backend.findById('documents', id); }
  updateDocument(id, fields)  { return this._backend.update('documents', id, fields); }

  async deleteDocument(id) {
    const doc = await this._backend.findById('documents', id);
    return this._backend.delete(
      'documents', id,
      doc ? [{ field: 'knowledgeStoreId', value: doc.knowledgeStoreId }] : []
    );
  }

  // ── Webhooks ────────────────────────────────────────────────────────────────

  createWebhook(doc)          { return this._backend.insert('webhooks', doc); }
  listWebhooks()              { return this._backend.findAll('webhooks'); }
  getWebhook(id)              { return this._backend.findById('webhooks', id); }
  updateWebhook(id, fields)   { return this._backend.update('webhooks', id, fields); }
  deleteWebhook(id)           { return this._backend.delete('webhooks', id); }

  // ── Settings ─────────────────────────────────────────────────────────────────

  async getSettings() {
    return (await this._backend.findById('settings', 'global')) || { id: 'global' };
  }

  async updateSettings(fields) {
    const existing = await this._backend.findById('settings', 'global');
    if (existing) {
      return this._backend.update('settings', 'global', fields);
    }
    return this._backend.insert('settings', { id: 'global', ...fields });
  }
}

// Singleton
let _instance = null;
function getAdapter() {
  if (!_instance) _instance = new DeltaDatabaseAdapter();
  return _instance;
}

module.exports = { DeltaDatabaseAdapter, DeltaDatabaseClient, getAdapter };
