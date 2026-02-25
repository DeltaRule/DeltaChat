'use strict';

/**
 * Tests for DeltaDatabaseAdapter.js
 *
 * Authentication model (per DeltaDatabase OpenAPI spec):
 *   - Server-to-server clients supply the admin/API key DIRECTLY as the Bearer
 *     value on every request.  No POST /api/login, no token caching, no refresh.
 *   - Session tokens are for the built-in browser UI only.
 *
 * Strategy: construct DeltaDatabaseClient and replace client._http with a jest
 * mock object.
 */

function makeMockHttp() {
  return {
    get:    jest.fn(),
    put:    jest.fn(),
    delete: jest.fn(),
    post:   jest.fn(),
  };
}

function axiosError(status, message = 'error') {
  const err = new Error(message);
  err.response = { status };
  return err;
}

function makeClient(database = 'testdb') {
  const { DeltaDatabaseClient } = require('../db/DeltaDatabaseAdapter');
  const client = new DeltaDatabaseClient('http://localhost:8080', 'adminkey', database);
  client._http = makeMockHttp();
  return client;
}

// ── SCHEMAS ────────────────────────────────────────────────────────────────────

describe('SCHEMAS constant', () => {
  const EXPECTED_SCHEMA_IDS = ['chats','messages','knowledge_stores','documents','webhooks','settings'];

  test('registerSchemas processes exactly the six expected collections', async () => {
    const client = makeClient();
    client._http.get.mockRejectedValue(axiosError(404));
    client._http.put.mockResolvedValue({ data: {} });
    await client.registerSchemas();
    const putCalls = client._http.put.mock.calls.map((c) => c[0]);
    for (const id of EXPECTED_SCHEMA_IDS) {
      expect(putCalls).toContain(`/schema/${id}`);
    }
    expect(putCalls).toHaveLength(EXPECTED_SCHEMA_IDS.length);
  });

  test('each schema has the correct $id and required fields', async () => {
    const client = makeClient();
    const capturedBodies = {};
    client._http.get.mockRejectedValue(axiosError(404));
    client._http.put.mockImplementation((url, body) => {
      capturedBodies[url] = body;
      return Promise.resolve({ data: {} });
    });
    await client.registerSchemas();
    const checks = {
      '/schema/chats':            { $id: 'chats',            required: ['id', 'title'] },
      '/schema/messages':         { $id: 'messages',         required: ['id', 'chatId', 'role', 'content'] },
      '/schema/knowledge_stores': { $id: 'knowledge_stores', required: ['id', 'name'] },
      '/schema/documents':        { $id: 'documents',        required: ['id', 'knowledgeStoreId', 'filename'] },
      '/schema/webhooks':         { $id: 'webhooks',         required: ['id', 'url'] },
      '/schema/settings':         { $id: 'settings',         required: ['id'] },
    };
    for (const [url, expected] of Object.entries(checks)) {
      const body = capturedBodies[url];
      expect(body).toBeDefined();
      expect(body.$id).toBe(expected.$id);
      expect(body.$schema).toBe('http://json-schema.org/draft-07/schema#');
      expect(body.type).toBe('object');
      expect(body.required).toEqual(expect.arrayContaining(expected.required));
    }
  });
});

// ── _authHeader ────────────────────────────────────────────────────────────────

describe('DeltaDatabaseClient – _authHeader', () => {
  test('returns Authorization header with admin key directly as Bearer token', () => {
    const client = makeClient();
    expect(client._authHeader()).toEqual({ Authorization: 'Bearer adminkey' });
  });

  test('throws when adminKey is null', () => {
    const { DeltaDatabaseClient } = require('../db/DeltaDatabaseAdapter');
    const client = new DeltaDatabaseClient('http://localhost:8080', null, 'db');
    expect(() => client._authHeader()).toThrow(/DELTA_DB_ADMIN_KEY/);
  });

  test('does NOT call POST /api/login', () => {
    const client = makeClient();
    client._authHeader();
    expect(client._http.post).not.toHaveBeenCalled();
  });

  test('is synchronous – not a Promise', () => {
    const client = makeClient();
    const result = client._authHeader();
    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result).toBe('object');
  });
});

// ── _get ───────────────────────────────────────────────────────────────────────

describe('DeltaDatabaseClient – _get', () => {
  test('returns parsed data on 200', async () => {
    const client = makeClient();
    client._http.get.mockResolvedValue({ data: { id: '1' } });
    const result = await client._get('chats:1');
    expect(result).toEqual({ id: '1' });
    expect(client._http.get).toHaveBeenCalledWith(
      '/entity/testdb',
      expect.objectContaining({ params: { key: 'chats:1' } })
    );
  });

  test('sends correct Authorization header', async () => {
    const client = makeClient();
    client._http.get.mockResolvedValue({ data: {} });
    await client._get('chats:1');
    expect(client._http.get.mock.calls[0][1].headers).toEqual({ Authorization: 'Bearer adminkey' });
  });

  test('returns null on 404', async () => {
    const client = makeClient();
    client._http.get.mockRejectedValue(axiosError(404));
    expect(await client._get('chats:x')).toBeNull();
  });

  test('throws on 401 without retrying', async () => {
    const client = makeClient();
    client._http.get.mockRejectedValue(axiosError(401));
    await expect(client._get('chats:1')).rejects.toMatchObject({ response: { status: 401 } });
    expect(client._http.get).toHaveBeenCalledTimes(1);
  });

  test('never calls POST /api/login', async () => {
    const client = makeClient();
    client._http.get.mockResolvedValue({ data: {} });
    await client._get('chats:1');
    expect(client._http.post).not.toHaveBeenCalled();
  });
});

// ── _put ───────────────────────────────────────────────────────────────────────

describe('DeltaDatabaseClient – _put', () => {
  test('sends PUT /entity/{db} with entity payload and correct auth', async () => {
    const client = makeClient();
    client._http.put.mockResolvedValue({ data: {} });
    await client._put({ 'chats:1': { id: '1' } });
    expect(client._http.put).toHaveBeenCalledWith(
      '/entity/testdb',
      { 'chats:1': { id: '1' } },
      { headers: { Authorization: 'Bearer adminkey' } }
    );
  });

  test('throws on 401 without retrying', async () => {
    const client = makeClient();
    client._http.put.mockRejectedValue(axiosError(401));
    await expect(client._put({ k: {} })).rejects.toMatchObject({ response: { status: 401 } });
    expect(client._http.put).toHaveBeenCalledTimes(1);
  });

  test('never calls POST /api/login', async () => {
    const client = makeClient();
    client._http.put.mockResolvedValue({ data: {} });
    await client._put({ k: {} });
    expect(client._http.post).not.toHaveBeenCalled();
  });
});

// ── _deleteEntity ─────────────────────────────────────────────────────────────

describe('DeltaDatabaseClient – _deleteEntity', () => {
  test('sends DELETE /entity/{db}?key={k} with correct auth', async () => {
    const client = makeClient();
    client._http.delete.mockResolvedValue({ data: { status: 'ok' } });
    await client._deleteEntity('chats:1');
    expect(client._http.delete).toHaveBeenCalledWith(
      '/entity/testdb',
      { params: { key: 'chats:1' }, headers: { Authorization: 'Bearer adminkey' } }
    );
  });

  test('treats 404 as success (entity already gone)', async () => {
    const client = makeClient();
    client._http.delete.mockRejectedValue(axiosError(404));
    await expect(client._deleteEntity('chats:gone')).resolves.not.toThrow();
  });

  test('throws on non-404 errors', async () => {
    const client = makeClient();
    client._http.delete.mockRejectedValue(axiosError(403));
    await expect(client._deleteEntity('chats:1')).rejects.toMatchObject({ response: { status: 403 } });
  });

  test('never calls POST /api/login', async () => {
    const client = makeClient();
    client._http.delete.mockResolvedValue({ data: { status: 'ok' } });
    await client._deleteEntity('chats:1');
    expect(client._http.post).not.toHaveBeenCalled();
  });
});

// ── _getSchema ────────────────────────────────────────────────────────────────

describe('DeltaDatabaseClient – _getSchema', () => {
  test('returns schema on 200', async () => {
    const client = makeClient();
    const schema = { $id: 'chats', type: 'object' };
    client._http.get.mockResolvedValue({ data: schema });
    expect(await client._getSchema('chats')).toEqual(schema);
    expect(client._http.get).toHaveBeenCalledWith('/schema/chats');
  });

  test('returns null on 404', async () => {
    const client = makeClient();
    client._http.get.mockRejectedValue(axiosError(404));
    expect(await client._getSchema('chats')).toBeNull();
  });

  test('throws on 500', async () => {
    const client = makeClient();
    client._http.get.mockRejectedValue(axiosError(500));
    await expect(client._getSchema('chats')).rejects.toMatchObject({ response: { status: 500 } });
  });

  test('does NOT send Authorization header (no auth required per spec)', async () => {
    const client = makeClient();
    client._http.get.mockResolvedValue({ data: { $id: 'chats' } });
    await client._getSchema('chats');
    expect(client._http.get).toHaveBeenCalledWith('/schema/chats');
    expect(client._http.post).not.toHaveBeenCalled();
  });
});

// ── registerSchemas ────────────────────────────────────────────────────────────

describe('DeltaDatabaseClient – registerSchemas', () => {
  test('performs GET → PUT → GET for each schema, never calls login', async () => {
    const client = makeClient();
    client._http.get.mockRejectedValue(axiosError(404));
    client._http.put.mockResolvedValue({ data: {} });
    await client.registerSchemas();
    expect(client._http.get).toHaveBeenCalledTimes(12);
    expect(client._http.put).toHaveBeenCalledTimes(6);
    expect(client._http.post).not.toHaveBeenCalled();
  });

  test('logs "already present" when schema exists before PUT', async () => {
    const client = makeClient();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    client._http.get.mockResolvedValue({ data: { $id: 'chats' } });
    client._http.put.mockResolvedValue({ data: {} });
    await client.registerSchemas();
    expect(consoleSpy.mock.calls.map((c) => c[0]).some((m) => m.includes('already present'))).toBe(true);
    consoleSpy.mockRestore();
  });

  test('logs verified message when GET confirms $id after PUT', async () => {
    const client = makeClient();
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    let callCount = 0;
    client._http.get.mockImplementation((url) => {
      if (!url.startsWith('/schema/')) return Promise.reject(axiosError(404));
      callCount++;
      if (callCount % 2 === 1) return Promise.reject(axiosError(404));
      return Promise.resolve({ data: { $id: url.replace('/schema/', '') } });
    });
    client._http.put.mockResolvedValue({ data: {} });
    await client.registerSchemas();
    expect(consoleSpy.mock.calls.map((c) => c[0]).some((m) => m.includes('registered') && m.includes('✓'))).toBe(true);
    consoleSpy.mockRestore();
  });

  test('does not throw when PUT fails – logs warning and continues', async () => {
    const client = makeClient();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    client._http.get.mockRejectedValue(axiosError(404));
    client._http.put.mockRejectedValue(axiosError(403));
    await expect(client.registerSchemas()).resolves.not.toThrow();
    expect(warnSpy.mock.calls.length).toBeGreaterThanOrEqual(6);
    warnSpy.mockRestore();
  });
});

// ── insert ────────────────────────────────────────────────────────────────────

describe('DeltaDatabaseClient – insert', () => {
  test('generates id and timestamps, stores entity, updates index', async () => {
    const client = makeClient();
    client._http.get.mockImplementation(() => Promise.resolve({ data: { keys: [] } }));
    client._http.put.mockResolvedValue({ data: {} });
    const doc = await client.insert('chats', { title: 'Hello' });
    expect(doc.id).toBeDefined();
    expect(doc.title).toBe('Hello');
    expect(doc.createdAt).toBeDefined();
    expect(doc.updatedAt).toBeDefined();
  });

  test('respects caller-supplied id', async () => {
    const client = makeClient();
    client._http.get.mockImplementation(() => Promise.resolve({ data: { keys: [] } }));
    client._http.put.mockResolvedValue({ data: {} });
    const doc = await client.insert('chats', { id: 'fixed-id', title: 'T' });
    expect(doc.id).toBe('fixed-id');
  });

  test('adds secondary index entries when secondaryIndexFields provided', async () => {
    const client = makeClient();
    client._http.get.mockImplementation(() => Promise.resolve({ data: { keys: [] } }));
    client._http.put.mockResolvedValue({ data: {} });
    await client.insert('messages', { id: 'm1', chatId: 'c1', role: 'user', content: 'hi' }, ['chatId']);
    const secondaryPut = client._http.put.mock.calls.map((c) => c[1]).find((b) => b['messages:_idx:chatId:c1']);
    expect(secondaryPut).toBeDefined();
    expect(secondaryPut['messages:_idx:chatId:c1'].keys).toContain('m1');
  });
});

// ── findById ──────────────────────────────────────────────────────────────────

describe('DeltaDatabaseClient – findById', () => {
  test('returns the document when found', async () => {
    const client = makeClient();
    client._http.get.mockResolvedValue({ data: { id: '1', title: 'hi' } });
    expect(await client.findById('chats', '1')).toMatchObject({ id: '1' });
  });

  test('returns null for _deleted document', async () => {
    const client = makeClient();
    client._http.get.mockResolvedValue({ data: { id: '1', _deleted: true } });
    expect(await client.findById('chats', '1')).toBeNull();
  });

  test('returns null on 404', async () => {
    const client = makeClient();
    client._http.get.mockRejectedValue(axiosError(404));
    expect(await client.findById('chats', 'ghost')).toBeNull();
  });
});

// ── findAll ───────────────────────────────────────────────────────────────────

describe('DeltaDatabaseClient – findAll', () => {
  test('returns non-deleted documents from index', async () => {
    const client = makeClient();
    client._http.get
      .mockResolvedValueOnce({ data: { keys: ['a', 'b'] } })
      .mockResolvedValueOnce({ data: { id: 'a' } })
      .mockResolvedValueOnce({ data: { id: 'b', _deleted: true } });
    const result = await client.findAll('chats');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('a');
  });

  test('returns empty array when index is empty', async () => {
    const client = makeClient();
    client._http.get.mockResolvedValue({ data: { keys: [] } });
    expect(await client.findAll('chats')).toEqual([]);
  });
});

// ── update ────────────────────────────────────────────────────────────────────

describe('DeltaDatabaseClient – update', () => {
  test('merges fields and refreshes updatedAt', async () => {
    const client = makeClient();
    const existing = { id: '1', title: 'Old', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' };
    client._http.get.mockResolvedValue({ data: existing });
    client._http.put.mockResolvedValue({ data: {} });
    const updated = await client.update('chats', '1', { title: 'New' });
    expect(updated.title).toBe('New');
    expect(updated.createdAt).toBe(existing.createdAt);
    expect(updated.updatedAt).not.toBe(existing.updatedAt);
  });

  test('returns null when document not found', async () => {
    const client = makeClient();
    client._http.get.mockRejectedValue(axiosError(404));
    expect(await client.update('chats', 'ghost', { title: 'x' })).toBeNull();
  });
});

// ── delete ────────────────────────────────────────────────────────────────────

describe('DeltaDatabaseClient – delete', () => {
  test('uses DELETE /entity/{db}?key to hard-delete the entity', async () => {
    const client = makeClient();
    let getCallCount = 0;
    client._http.get.mockImplementation(() => {
      getCallCount++;
      if (getCallCount === 1) return Promise.resolve({ data: { id: '1' } });
      return Promise.resolve({ data: { keys: ['1'] } });
    });
    client._http.put.mockResolvedValue({ data: {} });
    client._http.delete.mockResolvedValue({ data: { status: 'ok' } });
    const result = await client.delete('chats', '1');
    expect(result).toEqual({ ok: true });
    expect(client._http.delete).toHaveBeenCalledWith(
      '/entity/testdb',
      expect.objectContaining({ params: { key: 'chats:1' } })
    );
  });

  test('does NOT PUT a soft-delete tombstone', async () => {
    const client = makeClient();
    let getCallCount = 0;
    client._http.get.mockImplementation(() => {
      getCallCount++;
      if (getCallCount === 1) return Promise.resolve({ data: { id: '1' } });
      return Promise.resolve({ data: { keys: ['1'] } });
    });
    client._http.put.mockResolvedValue({ data: {} });
    client._http.delete.mockResolvedValue({ data: { status: 'ok' } });
    await client.delete('chats', '1');
    const tombstone = client._http.put.mock.calls.find(
      (c) => c[1] && c[1]['chats:1'] && c[1]['chats:1']._deleted === true
    );
    expect(tombstone).toBeUndefined();
  });

  test('returns { ok: false } when entity does not exist', async () => {
    const client = makeClient();
    client._http.get.mockRejectedValue(axiosError(404));
    expect(await client.delete('chats', 'ghost')).toEqual({ ok: false });
    expect(client._http.delete).not.toHaveBeenCalled();
  });

  test('removes entity from master index', async () => {
    const client = makeClient();
    let getCallCount = 0;
    client._http.get.mockImplementation(() => {
      getCallCount++;
      if (getCallCount === 1) return Promise.resolve({ data: { id: '1' } });
      return Promise.resolve({ data: { keys: ['1', '2'] } });
    });
    client._http.put.mockResolvedValue({ data: {} });
    client._http.delete.mockResolvedValue({ data: { status: 'ok' } });
    await client.delete('chats', '1');
    const indexPut = client._http.put.mock.calls.find((c) => c[1] && c[1]['chats:_index']);
    expect(indexPut).toBeDefined();
    expect(indexPut[1]['chats:_index'].keys).not.toContain('1');
    expect(indexPut[1]['chats:_index'].keys).toContain('2');
  });
});

// ── query ─────────────────────────────────────────────────────────────────────

describe('DeltaDatabaseClient – query', () => {
  test('uses secondary index when populated', async () => {
    const client = makeClient();
    const msg = { id: 'm1', chatId: 'c1', role: 'user', content: 'hi' };
    client._http.get
      .mockResolvedValueOnce({ data: { keys: ['m1'] } })
      .mockResolvedValueOnce({ data: msg });
    const results = await client.query('messages', { chatId: 'c1' });
    expect(results).toHaveLength(1);
    expect(client._http.get.mock.calls[0][1].params.key).toBe('messages:_idx:chatId:c1');
  });

  test('falls back to findAll when secondary index is empty', async () => {
    const client = makeClient();
    const msg = { id: 'm2', chatId: 'c2', role: 'assistant', content: 'hello' };
    client._http.get
      .mockResolvedValueOnce({ data: { keys: [] } })
      .mockResolvedValueOnce({ data: { keys: ['m2'] } })
      .mockResolvedValueOnce({ data: msg });
    expect(await client.query('messages', { chatId: 'c2' })).toHaveLength(1);
  });

  test('respects limit', async () => {
    const client = makeClient();
    client._http.get
      .mockResolvedValueOnce({ data: { keys: ['x1', 'x2', 'x3'] } })
      .mockResolvedValueOnce({ data: { id: 'x1', chatId: 'cx' } })
      .mockResolvedValueOnce({ data: { id: 'x2', chatId: 'cx' } })
      .mockResolvedValueOnce({ data: { id: 'x3', chatId: 'cx' } });
    expect(await client.query('messages', { chatId: 'cx' }, 2)).toHaveLength(2);
  });
});

// ── DeltaDatabaseAdapter ──────────────────────────────────────────────────────

describe('DeltaDatabaseAdapter', () => {
  const ORIGINAL_ENV = { ...process.env };
  afterEach(() => { process.env = { ...ORIGINAL_ENV }; jest.resetModules(); });

  test('throws when DELTA_DB_URL is not set', () => {
    delete process.env.DELTA_DB_URL;
    const { DeltaDatabaseAdapter } = require('../db/DeltaDatabaseAdapter');
    expect(() => new DeltaDatabaseAdapter()).toThrow(/DELTA_DB_URL is required/);
  });

  test('error message includes Docker run command', () => {
    delete process.env.DELTA_DB_URL;
    const { DeltaDatabaseAdapter } = require('../db/DeltaDatabaseAdapter');
    expect(() => new DeltaDatabaseAdapter()).toThrow(/docker run/i);
  });

  test('constructs successfully when DELTA_DB_URL is set', () => {
    process.env.DELTA_DB_URL = 'http://localhost:8080';
    process.env.DELTA_DB_ADMIN_KEY = 'k';
    const { DeltaDatabaseAdapter } = require('../db/DeltaDatabaseAdapter');
    expect(() => new DeltaDatabaseAdapter()).not.toThrow();
  });

  test('mode getter returns "deltadatabase"', () => {
    process.env.DELTA_DB_URL = 'http://localhost:8080';
    const { DeltaDatabaseAdapter } = require('../db/DeltaDatabaseAdapter');
    expect(new DeltaDatabaseAdapter().mode).toBe('deltadatabase');
  });

  test('initialize() calls registerSchemas()', async () => {
    process.env.DELTA_DB_URL = 'http://localhost:8080';
    const { DeltaDatabaseAdapter } = require('../db/DeltaDatabaseAdapter');
    const adapter = new DeltaDatabaseAdapter();
    const mock = jest.fn().mockResolvedValue(undefined);
    adapter._backend.registerSchemas = mock;
    await adapter.initialize();
    expect(mock).toHaveBeenCalledTimes(1);
  });

  test('getAdapter() returns the same singleton', () => {
    process.env.DELTA_DB_URL = 'http://localhost:8080';
    const { getAdapter } = require('../db/DeltaDatabaseAdapter');
    expect(getAdapter()).toBe(getAdapter());
  });

  function makeAdapter() {
    process.env.DELTA_DB_URL = 'http://localhost:8080';
    const { DeltaDatabaseAdapter } = require('../db/DeltaDatabaseAdapter');
    const adapter = new DeltaDatabaseAdapter();
    const stub = jest.fn().mockResolvedValue({ id: 'x' });
    adapter._backend.insert   = stub;
    adapter._backend.findAll  = stub;
    adapter._backend.findById = stub;
    adapter._backend.update   = stub;
    adapter._backend.delete   = stub;
    adapter._backend.query    = stub;
    return { adapter, stub };
  }

  test('createChat() delegates to insert("chats")', async () => {
    const { adapter, stub } = makeAdapter();
    await adapter.createChat({ title: 'T' });
    expect(stub).toHaveBeenCalledWith('chats', { title: 'T' });
  });

  test('listChats() delegates to findAll("chats")', async () => {
    const { adapter, stub } = makeAdapter();
    stub.mockResolvedValue([]);
    await adapter.listChats();
    expect(stub).toHaveBeenCalledWith('chats');
  });

  test('getChat() delegates to findById("chats", id)', async () => {
    const { adapter, stub } = makeAdapter();
    await adapter.getChat('abc');
    expect(stub).toHaveBeenCalledWith('chats', 'abc');
  });

  test('updateChat() delegates to update("chats", id, fields)', async () => {
    const { adapter, stub } = makeAdapter();
    await adapter.updateChat('abc', { title: 'New' });
    expect(stub).toHaveBeenCalledWith('chats', 'abc', { title: 'New' });
  });

  test('deleteChat() delegates to delete("chats", id)', async () => {
    const { adapter, stub } = makeAdapter();
    await adapter.deleteChat('abc');
    expect(stub).toHaveBeenCalledWith('chats', 'abc');
  });

  test('createMessage() passes ["chatId"] secondary index', async () => {
    const { adapter, stub } = makeAdapter();
    await adapter.createMessage({ id: 'm1', chatId: 'c1', role: 'user', content: 'hi' });
    expect(stub).toHaveBeenCalledWith(
      'messages', { id: 'm1', chatId: 'c1', role: 'user', content: 'hi' }, ['chatId']
    );
  });

  test('listMessages() delegates to query("messages", { chatId })', async () => {
    const { adapter, stub } = makeAdapter();
    stub.mockResolvedValue([]);
    await adapter.listMessages('c1');
    expect(stub).toHaveBeenCalledWith('messages', { chatId: 'c1' });
  });

  test('deleteMessagesByChatId() hard-deletes all messages', async () => {
    process.env.DELTA_DB_URL = 'http://localhost:8080';
    const { DeltaDatabaseAdapter } = require('../db/DeltaDatabaseAdapter');
    const adapter = new DeltaDatabaseAdapter();
    const msgs = [{ id: 'm1', chatId: 'c1' }, { id: 'm2', chatId: 'c1' }];
    adapter._backend.query  = jest.fn().mockResolvedValue(msgs);
    adapter._backend.delete = jest.fn().mockResolvedValue({ ok: true });
    const result = await adapter.deleteMessagesByChatId('c1');
    expect(result).toEqual({ ok: true });
    expect(adapter._backend.delete).toHaveBeenCalledTimes(2);
    expect(adapter._backend.delete).toHaveBeenCalledWith('messages', 'm1', [{ field: 'chatId', value: 'c1' }]);
  });

  test('getSettings() returns { id: "global" } fallback when not in DB', async () => {
    process.env.DELTA_DB_URL = 'http://localhost:8080';
    const { DeltaDatabaseAdapter } = require('../db/DeltaDatabaseAdapter');
    const adapter = new DeltaDatabaseAdapter();
    adapter._backend.findById = jest.fn().mockResolvedValue(null);
    expect(await adapter.getSettings()).toEqual({ id: 'global' });
  });

  test('updateSettings() calls update when settings exist', async () => {
    process.env.DELTA_DB_URL = 'http://localhost:8080';
    const { DeltaDatabaseAdapter } = require('../db/DeltaDatabaseAdapter');
    const adapter = new DeltaDatabaseAdapter();
    adapter._backend.findById = jest.fn().mockResolvedValue({ id: 'global' });
    adapter._backend.update   = jest.fn().mockResolvedValue({ id: 'global' });
    await adapter.updateSettings({ openaiKey: 'new' });
    expect(adapter._backend.update).toHaveBeenCalledWith('settings', 'global', { openaiKey: 'new' });
  });

  test('updateSettings() always calls update (fallback has id, insert branch unreachable)', async () => {
    process.env.DELTA_DB_URL = 'http://localhost:8080';
    const { DeltaDatabaseAdapter } = require('../db/DeltaDatabaseAdapter');
    const adapter = new DeltaDatabaseAdapter();
    adapter._backend.findById = jest.fn().mockResolvedValue(null);
    adapter._backend.update   = jest.fn().mockResolvedValue({ id: 'global' });
    adapter._backend.insert   = jest.fn();
    await adapter.updateSettings({ openaiKey: 'new' });
    expect(adapter._backend.update).toHaveBeenCalledWith('settings', 'global', { openaiKey: 'new' });
    expect(adapter._backend.insert).not.toHaveBeenCalled();
  });
});
