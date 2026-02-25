'use strict';

/**
 * DeltaDatabaseAdapter
 *
 * Wraps the DeltaDatabase REST API (see docs/openapi.yaml).
 * Run DeltaDatabase with Docker:
 *
 *   docker run -d -p 8080:8080 -e ADMIN_KEY=changeme -v delta_data:/shared/db \
 *     donti/deltadatabase:latest-aio
 *
 * Configure via environment variables:
 *   DELTA_DB_URL       Base URL of the DeltaDatabase instance  (required)
 *   DELTA_DB_API_KEY   Admin key or scoped API key (dk_…)      (required)
 *   DELTA_DB_DATABASE  Database (namespace) name               (default: deltachat)
 *
 * ── Authentication ────────────────────────────────────────────────────────────
 * Per the OpenAPI spec: admin keys and API keys (dk_…) are used DIRECTLY as
 * Bearer tokens on every request.  No login step is needed, no session token is
 * obtained, and no token ever expires unless you explicitly set expires_in when
 * creating an API key.  POST /api/login exists only for the built-in browser UI.
 *
 * ── Authentication ───────────────────────────────────────────────────────────
 * Per the DeltaDatabase OpenAPI spec, server-to-server clients must supply an
 * admin key or API key directly as the Bearer value on every request.
 * POST /api/login is for the built-in browser UI only; session tokens are
 * short-lived, cannot be refreshed, and must NOT be used by backend services.
 *
 * ── Storage design ───────────────────────────────────────────────────────────
 * DeltaDatabase stores entities as key → JSON document pairs inside a named
 * database.  There is no built-in "list all" operation, so this adapter
 * maintains explicit index documents:
 *
 *   Key pattern                   Purpose
 *   ──────────────────────────    ────────────────────────────────────────────
 *   {col}:{id}                    The entity itself
 *   {col}:_index                  Master list of all active IDs
 *   {col}:_idx:{field}:{value}    Secondary index: IDs where doc[field]===value
 *
 * Deletions use the real DELETE /entity/{db}?key={k} endpoint and prune index
 * documents afterwards.
 *
 * ── Schema registration ───────────────────────────────────────────────────────
 * On startup, adapter.initialize() registers JSON Schemas for every collection
 * via PUT /schema/{schemaID} and then confirms them via GET /admin/schemas.
 *
 * ── Required configuration ───────────────────────────────────────────────────
 * DELTA_DB_URL must always be set.  The app will refuse to start without it.
 */

const axios = require('axios');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');

// ── JSON Schemas for DeltaDatabase collections ────────────────────────────────

const SCHEMAS = {
  chats: {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'chats',
    type: 'object',
    properties: {
      id:               { type: 'string' },
      title:            { type: 'string' },
      model:            { type: ['string', 'null'] },
      systemPrompt:     { type: ['string', 'null'] },
      knowledgeStoreIds:{ type: 'array', items: { type: 'string' } },
      webhookId:        { type: ['string', 'null'] },
      metadata:         { type: 'object' },
      createdAt:        { type: 'string' },
      updatedAt:        { type: 'string' },
    },
    required: ['id', 'title'],
  },

  messages: {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'messages',
    type: 'object',
    properties: {
      id:        { type: 'string' },
      chatId:    { type: 'string' },
      role:      { type: 'string', enum: ['user', 'assistant', 'system'] },
      content:   { type: 'string' },
      model:     { type: ['string', 'null'] },
      usage:     { type: ['object', 'null'] },
      createdAt: { type: 'string' },
      updatedAt: { type: 'string' },
    },
    required: ['id', 'chatId', 'role', 'content'],
  },

  knowledge_stores: {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'knowledge_stores',
    type: 'object',
    properties: {
      id:             { type: 'string' },
      name:           { type: 'string' },
      description:    { type: 'string' },
      embeddingModel: { type: ['string', 'null'] },
      metadata:       { type: 'object' },
      createdAt:      { type: 'string' },
      updatedAt:      { type: 'string' },
    },
    required: ['id', 'name'],
  },

  documents: {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'documents',
    type: 'object',
    properties: {
      id:               { type: 'string' },
      knowledgeStoreId: { type: 'string' },
      filename:         { type: 'string' },
      mimeType:         { type: 'string' },
      size:             { type: 'number' },
      chunkCount:       { type: 'number' },
      status:           { type: 'string', enum: ['processing', 'indexed', 'error'] },
      processorMeta:    { type: 'object' },
      errorMessage:     { type: 'string' },
      createdAt:        { type: 'string' },
      updatedAt:        { type: 'string' },
    },
    required: ['id', 'knowledgeStoreId', 'filename'],
  },

  webhooks: {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'webhooks',
    type: 'object',
    properties: {
      id:        { type: 'string' },
      name:      { type: 'string' },
      url:       { type: 'string' },
      events:    { type: 'array', items: { type: 'string' } },
      chatIds:   { type: 'array', items: { type: 'string' } },
      headers:   { type: 'object' },
      secret:    { type: ['string', 'null'] },
      enabled:   { type: 'boolean' },
      createdAt: { type: 'string' },
      updatedAt: { type: 'string' },
    },
    required: ['id', 'url'],
  },

  settings: {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: 'settings',
    type: 'object',
    properties: {
      id:        { type: 'string' },
      createdAt: { type: 'string' },
      updatedAt: { type: 'string' },
    },
    required: ['id'],
  },
};

// ── DeltaDatabaseClient ───────────────────────────────────────────────────────

class DeltaDatabaseClient {
  constructor(baseUrl, apiKey, database) {
    this.baseUrl  = baseUrl.replace(/\/$/, '');
    this.apiKey   = apiKey || null;
    this.database = database || 'deltachat';
    this._http = axios.create({ baseURL: this.baseUrl, timeout: 15000 });
  }

  // ── Auth ────────────────────────────────────────────────────────────────────
  //
  // Per the OpenAPI spec: admin keys and API keys (dk_…) are supplied directly
  // as the Bearer value on every request.  No login step is needed.

  _authHeader() {
    return { Authorization: `Bearer ${this.apiKey}` };
  }

  // ── DeltaDatabase REST helpers ────────────────────────────────────────────────

  /** PUT /entity/{db}  { key: doc, … }  – upsert one or more entities. */
  async _put(entities) {
    await this._http.put(`/entity/${this.database}`, entities, {
      headers: this._authHeader(),
    });
  }

  /** GET /entity/{db}?key={k}  – fetch one entity; returns null on 404. */
  async _get(key) {
    try {
      const { data } = await this._http.get(`/entity/${this.database}`, {
        params: { key },
        headers: this._authHeader(),
      });
      return data;
    } catch (err) {
      if (err.response && err.response.status === 404) return null;
      throw err;
    }
  }

  /** DELETE /entity/{db}?key={k}  – hard-delete one entity. */
  async _deleteEntity(key) {
    await this._http.delete(`/entity/${this.database}`, {
      params: { key },
      headers: this._authHeader(),
    });
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
   * Hard-delete an entity via DELETE /entity/{db}?key={k}, then prune indexes.
   *
   * @param {string}   collection
   * @param {string}   id
   * @param {Array<{field:string,value:any}>} [secondaryIndexes]  indexes to prune
   */
  async delete(collection, id, secondaryIndexes = []) {
    const existing = await this.findById(collection, id);
    if (!existing) return { ok: false };

    await this._deleteEntity(`${collection}:${id}`);
    await this._removeFromIndex(collection, id);

    // Remove from all secondary indexes
    for (const { field, value } of secondaryIndexes) {
      await this._removeFromSecondaryIndex(collection, field, value, id);
    }

    // Hard-delete the entity via DELETE /entity/{db}?key=
    await this._deleteEntity(`${collection}:${id}`);

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

  /**
   * GET /schema/{schemaID}  – retrieve a stored schema (no auth required).
   * Returns the schema object or null if not found.
   */
  async _getSchema(schemaId) {
    try {
      const { data } = await this._http.get(`/schema/${schemaId}`);
      return data;
    } catch (err) {
      if (err.response && err.response.status === 404) return null;
      throw err;
    }
  }

  /**
   * Ensure JSON Schemas are registered in DeltaDatabase for every collection.
   *
   * For each schema:
   *   1. GET /schema/{schemaID}  — check whether it already exists.
   *   2. PUT /schema/{schemaID}  — store/update the latest definition.
   *   3. GET /schema/{schemaID}  — verify the stored schema matches expectation.
   *
   * Schema registration is best-effort: failures are logged but do not abort
   * startup so the application can still serve requests.
   */
  async registerSchemas() {
    const writeHeaders = this._authHeader();

    for (const [schemaId, schema] of Object.entries(SCHEMAS)) {
      try {
        // Step 1 – check current state
        const existing = await this._getSchema(schemaId);

        if (existing) {
          console.log(`[DeltaDB] Schema already present: ${schemaId} ($id: ${existing.$id || '–'})`);
        }

        // Step 2 – always PUT so the latest schema definition is stored
        await this._http.put(`/schema/${schemaId}`, schema, { headers: writeHeaders });

        // Step 3 – verify
        const stored = await this._getSchema(schemaId);
        if (stored && stored.$id === schema.$id) {
          console.log(`[DeltaDB] Schema ${existing ? 'updated' : 'registered'} ✓ ${schemaId}`);
        } else {
          console.warn(
            `[DeltaDB] ⚠  Schema verification failed for "${schemaId}": ` +
            `stored $id = ${stored ? stored.$id : 'null'}`
          );
        }
      } catch (err) {
        // Schema registration is best-effort: log but do not abort startup.
        const status = err.response ? err.response.status : 'network error';
        console.warn(
          `[DeltaDB] ⚠  Could not register schema "${schemaId}" (${status}): ${err.message}`
        );
      }
    }
  }

  /**
   * GET /admin/schemas  – list all registered schema IDs (no auth required).
   * Returns an array of schema ID strings, or an empty array on failure.
   */
  async listSchemas() {
    try {
      const { data } = await this._http.get('/admin/schemas');
      return Array.isArray(data) ? data : [];
    } catch (err) {
      const status = err.response ? err.response.status : 'network error';
      console.warn(`[DeltaDB] ⚠  Could not list schemas (${status}): ${err.message}`);
      return [];
    }
  }
}

// ── DeltaDatabaseAdapter ──────────────────────────────────────────────────────

class DeltaDatabaseAdapter {
  constructor() {
    if (!config.deltaDb.url) {
      throw new Error(
        '[DeltaDB] DELTA_DB_URL is required – DeltaDatabase must always be used.\n' +
        '  Start DeltaDatabase with Docker:\n' +
        '    docker run -d -p 8080:8080 -e ADMIN_KEY=changeme -v delta_data:/shared/db \\\n' +
        '      donti/deltadatabase:latest-aio\n' +
        '  Then set DELTA_DB_URL=http://127.0.0.1:8080 and DELTA_DB_API_KEY=changeme'
      );
    }

    this._backend = new DeltaDatabaseClient(
      config.deltaDb.url,
      config.deltaDb.apiKey,
      config.deltaDb.database
    );
    this._mode = 'deltadatabase';
    console.log(
      `[DeltaDB] Connected to DeltaDatabase at ${config.deltaDb.url}` +
      ` (database: "${config.deltaDb.database}")`
    );
  }

  /** Always "deltadatabase" – the only supported backend. */
  get mode() { return this._mode; }

  /**
   * Register JSON Schemas for all collections and confirm via GET /admin/schemas.
   * Call once at application startup after the adapter is created.
   */
  async initialize() {
    await this._backend.registerSchemas();
    const registered = await this._backend.listSchemas();
    if (registered.length > 0) {
      console.log(`[DeltaDB] Active schemas on server: ${registered.join(', ')}`);
    }
  }

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
    const existing = await this.getSettings();
    if (existing && existing.id) {
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
