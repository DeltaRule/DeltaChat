'use strict';

import axios, { AxiosInstance, AxiosError } from 'axios';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';
import { validate } from './schema';

const TOKEN_REFRESH_MARGIN_MS = 5 * 60 * 1000;

// ── Types ─────────────────────────────────────────────────────────────────────

export interface Entity extends Record<string, unknown> {
  id: string;
  createdAt?: string;
  updatedAt?: string;
  _deleted?: boolean;
}

export interface IndexDoc {
  keys: string[];
}

export interface SecondaryIndex {
  field: string;
  value: unknown;
}

export interface DeleteResult {
  ok: boolean;
}

export interface LoginResponse {
  token: string;
  expires_at?: string;
}

// ── DeltaDatabaseClient ───────────────────────────────────────────────────────

export class DeltaDatabaseClient {
  public readonly baseUrl: string;
  public readonly adminKey: string | null;
  public readonly database: string;
  public _token: string | null = null;
  public _tokenExpiry: number | null = null;
  public readonly _http: AxiosInstance;

  constructor(baseUrl: string, adminKey: string | null, database: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.adminKey = adminKey ?? null;
    this.database = database ?? 'deltachat';
    this._http = axios.create({ baseURL: this.baseUrl, timeout: 15000 });
  }

  async _ensureToken(): Promise<string> {
    const needsRefresh =
      !this._token ||
      (this._tokenExpiry !== null && Date.now() > this._tokenExpiry - TOKEN_REFRESH_MARGIN_MS);

    if (needsRefresh) {
      const body = this.adminKey ? { key: this.adminKey } : { client_id: 'deltachat' };
      const { data } = await this._http.post<LoginResponse>('/api/login', body);
      this._token = data.token;
      this._tokenExpiry = data.expires_at ? new Date(data.expires_at).getTime() : null;
    }
    return this._token!;
  }

  async _authHeader(): Promise<Record<string, string>> {
    return { Authorization: `Bearer ${await this._ensureToken()}` };
  }

  async _put(entities: Record<string, unknown>): Promise<void> {
    const headers = await this._authHeader();
    try {
      await this._http.put(`/entity/${this.database}`, entities, { headers });
    } catch (err) {
      const axErr = err as AxiosError;
      if (axErr.response?.status === 401) {
        this._token = null;
        const h = await this._authHeader();
        await this._http.put(`/entity/${this.database}`, entities, { headers: h });
      } else {
        throw err;
      }
    }
  }

  async _get(key: string): Promise<unknown> {
    const headers = await this._authHeader();
    try {
      const { data } = await this._http.get<unknown>(`/entity/${this.database}`, {
        params: { key },
        headers,
      });
      return data;
    } catch (err) {
      const axErr = err as AxiosError;
      if (axErr.response?.status === 404) return null;
      if (axErr.response?.status === 401) {
        this._token = null;
        const h = await this._authHeader();
        const { data } = await this._http.get<unknown>(`/entity/${this.database}`, {
          params: { key },
          headers: h,
        });
        return data;
      }
      throw err;
    }
  }

  async _readIndex(collection: string): Promise<IndexDoc> {
    return ((await this._get(`${collection}:_index`)) as IndexDoc | null) ?? { keys: [] };
  }

  async _addToIndex(collection: string, id: string): Promise<void> {
    const idx = await this._readIndex(collection);
    if (!idx.keys.includes(id)) {
      idx.keys.push(id);
      await this._put({ [`${collection}:_index`]: idx });
    }
  }

  async _removeFromIndex(collection: string, id: string): Promise<void> {
    const idx = await this._readIndex(collection);
    const before = idx.keys.length;
    idx.keys = idx.keys.filter((k) => k !== id);
    if (idx.keys.length !== before) {
      await this._put({ [`${collection}:_index`]: idx });
    }
  }

  async _addToSecondaryIndex(collection: string, field: string, value: unknown, id: string): Promise<void> {
    const key = `${collection}:_idx:${field}:${String(value)}`;
    const idx = ((await this._get(key)) as IndexDoc | null) ?? { keys: [] };
    if (!idx.keys.includes(id)) {
      idx.keys.push(id);
      await this._put({ [key]: idx });
    }
  }

  async _removeFromSecondaryIndex(collection: string, field: string, value: unknown, id: string): Promise<void> {
    const key = `${collection}:_idx:${field}:${String(value)}`;
    const idx = ((await this._get(key)) as IndexDoc | null) ?? { keys: [] };
    const before = idx.keys.length;
    idx.keys = idx.keys.filter((k) => k !== id);
    if (idx.keys.length !== before) {
      await this._put({ [key]: idx });
    }
  }

  async insert(collection: string, doc: Record<string, unknown>, secondaryIndexFields: string[] = []): Promise<Entity> {
    const now = new Date().toISOString();
    const id = (doc['id'] as string | undefined) ?? uuidv4();
    const entity: Entity = {
      ...doc,
      id,
      createdAt: (doc['createdAt'] as string | undefined) ?? now,
      updatedAt: now,
    };

    validate(collection, entity as Record<string, unknown>);

    await this._put({ [`${collection}:${id}`]: entity });
    await this._addToIndex(collection, id);

    for (const field of secondaryIndexFields) {
      if (entity[field] !== undefined) {
        await this._addToSecondaryIndex(collection, field, entity[field], id);
      }
    }
    return entity;
  }

  async findAll(collection: string): Promise<Entity[]> {
    const idx = await this._readIndex(collection);
    if (!idx.keys.length) return [];
    const docs = await Promise.all(idx.keys.map((id) => this._get(`${collection}:${id}`)));
    return (docs as (Entity | null)[]).filter((d): d is Entity => !!d && !d._deleted);
  }

  async findById(collection: string, id: string): Promise<Entity | null> {
    const doc = (await this._get(`${collection}:${id}`)) as Entity | null;
    return doc && !doc._deleted ? doc : null;
  }

  async update(collection: string, id: string, fields: Record<string, unknown>): Promise<Entity | null> {
    const existing = await this.findById(collection, id);
    if (!existing) return null;
    const updated: Entity = {
      ...existing,
      ...fields,
      id,
      createdAt: existing.createdAt,
      updatedAt: new Date().toISOString(),
    };
    await this._put({ [`${collection}:${id}`]: updated });
    return updated;
  }

  async delete(collection: string, id: string, secondaryIndexes: SecondaryIndex[] = []): Promise<DeleteResult> {
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

  async query(collection: string, filter: Record<string, unknown> = {}, limit = 100): Promise<Entity[]> {
    const filterEntries = Object.entries(filter);
    if (!filterEntries.length) return this.findAll(collection);

    const [field, value] = filterEntries[0] as [string, unknown];
    const idxKey = `${collection}:_idx:${field}:${String(value)}`;
    const idx = ((await this._get(idxKey)) as IndexDoc | null) ?? { keys: [] };

    let docs: Entity[];
    if (idx.keys.length > 0) {
      const fetched = await Promise.all(idx.keys.map((id) => this._get(`${collection}:${id}`)));
      docs = (fetched as (Entity | null)[]).filter((d): d is Entity => !!d && !d._deleted);
    } else {
      docs = await this.findAll(collection);
    }

    for (const [k, v] of filterEntries.slice(1)) {
      docs = docs.filter((d) => d[k] === v);
    }

    return docs.slice(0, limit);
  }
}

// ── DeltaDatabaseAdapter ──────────────────────────────────────────────────────

export class DeltaDatabaseAdapter {
  public _backend: DeltaDatabaseClient;

  constructor() {
    if (!config.deltaDb.url) {
      throw new Error(
        '[DeltaDB] DELTA_DB_URL is required. Start DeltaDatabase with:\n' +
        '  docker run -d --name deltadatabase -p 8080:8080 -e ADMIN_KEY=secretkey donti/deltadatabase\n' +
        '  Then set DELTA_DB_URL=http://127.0.0.1:8080 and DELTA_DB_ADMIN_KEY=secretkey'
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

  get mode(): string { return 'deltadatabase'; }

  // Chats
  createChat(doc: Record<string, unknown>): Promise<Entity> { return this._backend.insert('chats', doc); }
  listChats(): Promise<Entity[]> { return this._backend.findAll('chats'); }
  getChat(id: string): Promise<Entity | null> { return this._backend.findById('chats', id); }
  updateChat(id: string, fields: Record<string, unknown>): Promise<Entity | null> { return this._backend.update('chats', id, fields); }
  deleteChat(id: string): Promise<DeleteResult> { return this._backend.delete('chats', id); }

  // Messages
  createMessage(doc: Record<string, unknown>): Promise<Entity> { return this._backend.insert('messages', doc, ['chatId']); }
  listMessages(chatId: string): Promise<Entity[]> { return this._backend.query('messages', { chatId }); }
  getMessage(id: string): Promise<Entity | null> { return this._backend.findById('messages', id); }
  updateMessage(id: string, fields: Record<string, unknown>): Promise<Entity | null> { return this._backend.update('messages', id, fields); }

  async deleteMessage(id: string): Promise<DeleteResult> {
    const msg = await this._backend.findById('messages', id);
    return this._backend.delete('messages', id, msg ? [{ field: 'chatId', value: msg['chatId'] }] : []);
  }

  async deleteMessagesByChatId(chatId: string): Promise<{ ok: boolean }> {
    const msgs = await this.listMessages(chatId);
    for (const m of msgs) {
      await this._backend.delete('messages', m.id, [{ field: 'chatId', value: chatId }]);
    }
    return { ok: true };
  }

  // Knowledge Stores
  createKnowledgeStore(doc: Record<string, unknown>): Promise<Entity> { return this._backend.insert('knowledge_stores', doc); }
  listKnowledgeStores(): Promise<Entity[]> { return this._backend.findAll('knowledge_stores'); }
  getKnowledgeStore(id: string): Promise<Entity | null> { return this._backend.findById('knowledge_stores', id); }
  updateKnowledgeStore(id: string, fields: Record<string, unknown>): Promise<Entity | null> { return this._backend.update('knowledge_stores', id, fields); }
  deleteKnowledgeStore(id: string): Promise<DeleteResult> { return this._backend.delete('knowledge_stores', id); }

  // Documents
  createDocument(doc: Record<string, unknown>): Promise<Entity> { return this._backend.insert('documents', doc, ['knowledgeStoreId']); }
  listDocuments(knowledgeStoreId: string): Promise<Entity[]> { return this._backend.query('documents', { knowledgeStoreId }); }
  getDocument(id: string): Promise<Entity | null> { return this._backend.findById('documents', id); }
  updateDocument(id: string, fields: Record<string, unknown>): Promise<Entity | null> { return this._backend.update('documents', id, fields); }

  async deleteDocument(id: string): Promise<DeleteResult> {
    const doc = await this._backend.findById('documents', id);
    return this._backend.delete('documents', id, doc ? [{ field: 'knowledgeStoreId', value: doc['knowledgeStoreId'] }] : []);
  }

  // Webhooks
  createWebhook(doc: Record<string, unknown>): Promise<Entity> { return this._backend.insert('webhooks', doc); }
  listWebhooks(): Promise<Entity[]> { return this._backend.findAll('webhooks'); }
  getWebhook(id: string): Promise<Entity | null> { return this._backend.findById('webhooks', id); }
  updateWebhook(id: string, fields: Record<string, unknown>): Promise<Entity | null> { return this._backend.update('webhooks', id, fields); }
  deleteWebhook(id: string): Promise<DeleteResult> { return this._backend.delete('webhooks', id); }

  // Settings
  async getSettings(): Promise<Entity> {
    return (await this._backend.findById('settings', 'global')) ?? { id: 'global' };
  }

  async updateSettings(fields: Record<string, unknown>): Promise<Entity | null> {
    const existing = await this._backend.findById('settings', 'global');
    if (existing) return this._backend.update('settings', 'global', fields);
    return this._backend.insert('settings', { id: 'global', ...fields });
  }
}

let _instance: DeltaDatabaseAdapter | null = null;
export function getAdapter(): DeltaDatabaseAdapter {
  if (!_instance) _instance = new DeltaDatabaseAdapter();
  return _instance;
}
