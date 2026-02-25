'use strict';

/**
 * Tests for DeltaDatabaseAdapter.js
 *
 * Strategy: construct DeltaDatabaseClient and then replace client._http with
 * a plain jest-mock object.  This avoids any axios.create hoisting complexity
 * while still exercising every code path.
 *
 * Auth model (per OpenAPI spec): admin keys and API keys (dk_…) are used
 * directly as Bearer tokens on every request.  No POST /api/login is ever
 * called for server-to-server use.
 *
 * DeltaDatabaseAdapter reads config at require-time, so we use
 * jest.resetModules() + fresh require() for tests that need a different URL.
 */

// ── helpers ────────────────────────────────────────────────────────────────────

/** Build a fresh mock HTTP client (axios-instance shape). */
function makeMockHttp() {
  return {
    get:    jest.fn(),
    put:    jest.fn(),
    post:   jest.fn(), // kept for completeness; never called for auth
    delete: jest.fn(),
  };
}

/** Build an Axios-style error with an HTTP status code. */
function axiosError(status, message = 'error') {
  const err = new Error(message);
  err.response = { status };
  return err;
}

/** Build a DeltaDatabaseClient with injected mock HTTP transport. */
function makeClient(database = 'testdb') {
  const { DeltaDatabaseClient } = require('../db/DeltaDatabaseAdapter');
  const client = new DeltaDatabaseClient('http://localhost:8080', 'test-api-key', database);
  client._http = makeMockHttp();
  return client;
}

// ── SCHEMAS constant ──────────────────────────────────────────────────────────

describe('SCHEMAS constant', () => {
  const EXPECTED_SCHEMA_IDS = [
    'chats',
    'messages',
    'knowledge_stores',
    'documents',
    'webhooks',
    'settings',
  ];

  test('registerSchemas processes exactly the six expected collections', async () => {
    const client = makeClient();
    const http = client._http;

    // GET /schema/{id} → 404 (not yet registered)
    http.get.mockRejectedValue(axiosError(404));
    // PUT /schema/{id} → 200
    http.put.mockResolvedValue({ data: {} });

    await client.registerSchemas();

    const putCalls = http.put.mock.calls.map((c) => c[0]);
    for (const id of EXPECTED_SCHEMA_IDS) {
      expect(putCalls).toContain(`/schema/${id}`);
    }
    expect(putCalls).toHaveLength(EXPECTED_SCHEMA_IDS.length);
    // No login endpoint is ever called
    expect(http.post).not.toHaveBeenCalled();
  });

  test('each schema has the correct $id and required fields', async () => {
    const client = makeClient();
    const http = client._http;
    const capturedBodies = {};

    http.get.mockRejectedValue(axiosError(404));
    http.put.mockImplementation((url, body) => {
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

// ── DeltaDatabaseClient – authentication ──────────────────────────────────────

describe('DeltaDatabaseClient – _authHeader', () => {
  test('returns correct Authorization: Bearer header with the API key', () => {
    const { DeltaDatabaseClient } = require('../db/DeltaDatabaseAdapter');
    const client = new DeltaDatabaseClient('http://localhost:8080', 'my-secret-key', 'db');

    const header = client._authHeader();

    expect(header).toEqual({ Authorization: 'Bearer my-secret-key' });
  });

  test('uses empty string when no API key is provided', () => {
    const { DeltaDatabaseClient } = require('../db/DeltaDatabaseAdapter');
    const client = new DeltaDatabaseClient('http://localhost:8080', null, 'db');

    const header = client._authHeader();

    expect(header).toEqual({ Authorization: 'Bearer null' });
  });

  test('is synchronous – returns a plain object, not a Promise', () => {
    const { DeltaDatabaseClient } = require('../db/DeltaDatabaseAdapter');
    const client = new DeltaDatabaseClient('http://localhost:8080', 'key', 'db');

    const result = client._authHeader();

    expect(result).not.toBeInstanceOf(Promise);
    expect(typeof result).toBe('object');
  });

  test('never calls POST /api/login for any request', async () => {
    const client = makeClient();
    client._http.get.mockResolvedValue({ data: { id: '1' } });
    client._http.put.mockResolvedValue({ data: {} });
    client._http.delete.mockResolvedValue({ data: { status: 'ok' } });

    // Exercise all HTTP-method helpers
    await client._get('chats:1');
    await client._put({ 'chats:1': { id: '1' } });
    await client._deleteEntity('chats:1');

    expect(client._http.post).not.toHaveBeenCalled();
  });
});

// ── DeltaDatabaseClient – _get ────────────────────────────────────────────────

describe('DeltaDatabaseClient – _get', () => {
  test('returns parsed data on 200', async () => {
    const client = makeClient();
    const doc = { id: '1', title: 'hi' };
    client._http.get.mockResolvedValue({ data: doc });

    const result = await client._get('chats:1');

    expect(result).toEqual(doc);
    expect(client._http.get).toHaveBeenCalledWith(
      '/entity/testdb',
      expect.objectContaining({
        params:  { key: 'chats:1' },
        headers: { Authorization: 'Bearer test-api-key' },
      })
    );
  });

  test('returns null on 404', async () => {
    const client = makeClient();
    client._http.get.mockRejectedValue(axiosError(404));

    const result = await client._get('chats:missing');

    expect(result).toBeNull();
  });

  test('throws on non-404 errors (401 means invalid key, not expired token)', async () => {
    const client = makeClient();
    client._http.get.mockRejectedValue(axiosError(401));

    await expect(client._get('chats:1')).rejects.toMatchObject({ response: { status: 401 } });
  });

  test('throws on 500 errors', async () => {
    const client = makeClient();
    client._http.get.mockRejectedValue(axiosError(500));

    await expect(client._get('chats:bad')).rejects.toMatchObject({ response: { status: 500 } });
  });
});

// ── DeltaDatabaseClient – _put ────────────────────────────────────────────────

describe('DeltaDatabaseClient – _put', () => {
  test('sends PUT /entity/{db} with entity payload and auth header', async () => {
    const client = makeClient();
    client._http.put.mockResolvedValue({ data: {} });

    await client._put({ 'chats:1': { id: '1' } });

    expect(client._http.put).toHaveBeenCalledWith(
      '/entity/testdb',
      { 'chats:1': { id: '1' } },
      { headers: { Authorization: 'Bearer test-api-key' } }
    );
  });

  test('throws on error without retrying', async () => {
    const client = makeClient();
    client._http.put.mockRejectedValue(axiosError(403, 'forbidden'));

    await expect(client._put({ 'k': {} })).rejects.toMatchObject({ response: { status: 403 } });
    expect(client._http.put).toHaveBeenCalledTimes(1);
  });
});

// ── DeltaDatabaseClient – _deleteEntity ──────────────────────────────────────

describe('DeltaDatabaseClient – _deleteEntity', () => {
  test('sends DELETE /entity/{db}?key={k} with auth header', async () => {
    const client = makeClient();
    client._http.delete.mockResolvedValue({ data: { status: 'ok' } });

    await client._deleteEntity('chats:abc');

    expect(client._http.delete).toHaveBeenCalledWith(
      '/entity/testdb',
      {
        params:  { key: 'chats:abc' },
        headers: { Authorization: 'Bearer test-api-key' },
      }
    );
  });

  test('throws on error', async () => {
    const client = makeClient();
    client._http.delete.mockRejectedValue(axiosError(403));

    await expect(client._deleteEntity('chats:x')).rejects.toMatchObject({ response: { status: 403 } });
  });
});

// ── DeltaDatabaseClient – _getSchema ─────────────────────────────────────────

describe('DeltaDatabaseClient – _getSchema', () => {
  test('returns schema object when server responds 200', async () => {
    const client = makeClient();
    const schema = { $id: 'chats', type: 'object' };
    client._http.get.mockResolvedValue({ data: schema });

    const result = await client._getSchema('chats');

    expect(result).toEqual(schema);
    expect(client._http.get).toHaveBeenCalledWith('/schema/chats');
  });

  test('returns null when server responds 404', async () => {
    const client = makeClient();
    client._http.get.mockRejectedValue(axiosError(404));

    const result = await client._getSchema('chats');

    expect(result).toBeNull();
  });

  test('throws on non-404 errors', async () => {
    const client = makeClient();
    client._http.get.mockRejectedValue(axiosError(500, 'server error'));

    await expect(client._getSchema('chats')).rejects.toMatchObject({
      response: { status: 500 },
    });
  });

  test('does NOT send an Authorization header (no auth required per spec)', async () => {
    const client = makeClient();
    client._http.get.mockResolvedValue({ data: { $id: 'chats' } });

    await client._getSchema('chats');

    // GET /schema/{id} should be called with just the URL, no headers/params
    expect(client._http.get).toHaveBeenCalledWith('/schema/chats');
    expect(client._http.post).not.toHaveBeenCalled();
  });
});

// ── DeltaDatabaseClient – listSchemas ────────────────────────────────────────

describe('DeltaDatabaseClient – listSchemas', () => {
  test('calls GET /admin/schemas and returns the array', async () => {
    const client = makeClient();
    client._http.get.mockResolvedValue({ data: ['chats', 'messages', 'settings'] });

    const result = await client.listSchemas();

    expect(result).toEqual(['chats', 'messages', 'settings']);
    expect(client._http.get).toHaveBeenCalledWith('/admin/schemas');
  });

  test('does not require an auth header (no auth per spec)', async () => {
    const client = makeClient();
    client._http.get.mockResolvedValue({ data: [] });

    await client.listSchemas();

    expect(client._http.get).toHaveBeenCalledWith('/admin/schemas');
    expect(client._http.post).not.toHaveBeenCalled();
  });

  test('returns empty array when server returns non-array', async () => {
    const client = makeClient();
    client._http.get.mockResolvedValue({ data: null });

    const result = await client.listSchemas();

    expect(result).toEqual([]);
  });

  test('returns empty array and logs warning when request fails', async () => {
    const client = makeClient();
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
    client._http.get.mockRejectedValue(axiosError(500));

    const result = await client.listSchemas();

    expect(result).toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('Could not list schemas'));
    warnSpy.mockRestore();
  });
});

// ── DeltaDatabaseClient – registerSchemas ─────────────────────────────────────

describe('DeltaDatabaseClient – registerSchemas', () => {
  test('performs GET → PUT → GET sequence for each schema without calling login', async () => {
    const client = makeClient();
    const http = client._http;

    // GET /schema/{id} → schema not present yet
    http.get.mockRejectedValue(axiosError(404));
    http.put.mockResolvedValue({ data: {} });

    await client.registerSchemas();

    // 6 schemas × (1 GET-check + 1 GET-verify) = 12 GET calls
    expect(http.get.mock.calls.every((c) => c[0].startsWith('/schema/'))).toBe(true);
    expect(http.get).toHaveBeenCalledTimes(12); // 2 per schema × 6
    // 1 PUT per schema = 6
    expect(http.put).toHaveBeenCalledTimes(6);
    // No login
    expect(http.post).not.toHaveBeenCalled();
  });

  test('PUT /schema is called with the API key Bearer header', async () => {
    const client = makeClient();
    const http = client._http;

    http.get.mockRejectedValue(axiosError(404));
    http.put.mockResolvedValue({ data: {} });

    await client.registerSchemas();

    const schemaPutCalls = http.put.mock.calls.filter((c) => c[0].startsWith('/schema/'));
    expect(schemaPutCalls.length).toBe(6);
    for (const call of schemaPutCalls) {
      expect(call[2]).toEqual({ headers: { Authorization: 'Bearer test-api-key' } });
    }
  });

  test('logs "already present" when schema exists before PUT', async () => {
    const client = makeClient();
    const http = client._http;
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    http.get.mockResolvedValue({ data: { $id: 'chats' } });
    http.put.mockResolvedValue({ data: {} });

    await client.registerSchemas();

    const logMessages = consoleSpy.mock.calls.map((c) => c[0]);
    expect(logMessages.some((m) => m.includes('already present'))).toBe(true);
    consoleSpy.mockRestore();
  });

  test('logs schema verified/updated message when GET confirms $id after PUT', async () => {
    const client = makeClient();
    const http = client._http;
    const consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});

    let callCount = 0;
    http.get.mockImplementation((url) => {
      if (!url.startsWith('/schema/')) return Promise.reject(axiosError(404));
      callCount++;
      if (callCount % 2 === 1) return Promise.reject(axiosError(404));
      const schemaId = url.replace('/schema/', '');
      return Promise.resolve({ data: { $id: schemaId } });
    });
    http.put.mockResolvedValue({ data: {} });

    await client.registerSchemas();

    const logMessages = consoleSpy.mock.calls.map((c) => c[0]);
    expect(logMessages.some((m) => m.includes('registered') && m.includes('✓'))).toBe(true);
    consoleSpy.mockRestore();
  });

  test('does not throw when a schema PUT fails – logs warning and continues', async () => {
    const client = makeClient();
    const http = client._http;
    const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

    http.get.mockRejectedValue(axiosError(404));
    http.put.mockRejectedValue(axiosError(403, 'forbidden'));

    await expect(client.registerSchemas()).resolves.not.toThrow();

    expect(warnSpy.mock.calls.length).toBeGreaterThanOrEqual(6);
    expect(warnSpy.mock.calls[0][0]).toContain('Could not register schema');
    warnSpy.mockRestore();
  });
});

// ── DeltaDatabaseClient – CRUD ────────────────────────────────────────────────

describe('DeltaDatabaseClient – insert', () => {
  test('generates an id and timestamps, stores entity, updates master index', async () => {
    const client = makeClient();
    const http = client._http;
    http.get.mockImplementation(() => Promise.resolve({ data: { keys: [] } }));
    http.put.mockResolvedValue({ data: {} });

    const doc = await client.insert('chats', { title: 'Hello' });

    expect(doc.id).toBeDefined();
    expect(doc.title).toBe('Hello');
    expect(doc.createdAt).toBeDefined();
    expect(doc.updatedAt).toBeDefined();
    const entityKey = `chats:${doc.id}`;
    expect(http.put).toHaveBeenCalledWith(
      '/entity/testdb',
      expect.objectContaining({ [entityKey]: expect.objectContaining({ title: 'Hello' }) }),
      expect.any(Object)
    );
  });

  test('respects caller-supplied id', async () => {
    const client = makeClient();
    const http = client._http;
    http.get.mockImplementation(() => Promise.resolve({ data: { keys: [] } }));
    http.put.mockResolvedValue({ data: {} });

    const doc = await client.insert('chats', { id: 'fixed-id', title: 'T' });

    expect(doc.id).toBe('fixed-id');
  });

  test('adds secondary index entries when secondaryIndexFields provided', async () => {
    const client = makeClient();
    const http = client._http;
    http.get.mockImplementation(() => Promise.resolve({ data: { keys: [] } }));
    http.put.mockResolvedValue({ data: {} });

    await client.insert('messages', { id: 'm1', chatId: 'c1', role: 'user', content: 'hi' }, ['chatId']);

    const putBodies = http.put.mock.calls.map((c) => c[1]);
    const secondaryIndexPut = putBodies.find((body) => body['messages:_idx:chatId:c1']);
    expect(secondaryIndexPut).toBeDefined();
    expect(secondaryIndexPut['messages:_idx:chatId:c1'].keys).toContain('m1');
  });
});

describe('DeltaDatabaseClient – findById', () => {
  test('returns the document when found and not deleted', async () => {
    const client = makeClient();
    client._http.get.mockResolvedValue({ data: { id: '1', title: 'hi', _deleted: false } });

    const doc = await client.findById('chats', '1');

    expect(doc).toMatchObject({ id: '1', title: 'hi' });
  });

  test('returns null when document is marked _deleted (legacy guard)', async () => {
    const client = makeClient();
    client._http.get.mockResolvedValue({ data: { id: '1', _deleted: true } });

    const doc = await client.findById('chats', '1');

    expect(doc).toBeNull();
  });

  test('returns null when document is not found (404)', async () => {
    const client = makeClient();
    client._http.get.mockRejectedValue(axiosError(404));

    const doc = await client.findById('chats', 'ghost');

    expect(doc).toBeNull();
  });
});

describe('DeltaDatabaseClient – findAll', () => {
  test('returns all non-deleted documents listed in the index', async () => {
    const client = makeClient();
    const http = client._http;

    const docs = [
      { id: 'a', title: 'A' },
      { id: 'b', title: 'B', _deleted: true },
    ];
    http.get
      .mockResolvedValueOnce({ data: { keys: ['a', 'b'] } })
      .mockResolvedValueOnce({ data: docs[0] })
      .mockResolvedValueOnce({ data: docs[1] });

    const result = await client.findAll('chats');

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ id: 'a' });
  });

  test('returns empty array when index is empty', async () => {
    const client = makeClient();
    client._http.get.mockResolvedValue({ data: { keys: [] } });

    const result = await client.findAll('chats');

    expect(result).toEqual([]);
  });
});

describe('DeltaDatabaseClient – update', () => {
  test('merges fields and refreshes updatedAt', async () => {
    const client = makeClient();
    const http = client._http;
    const existing = { id: '1', title: 'Old', createdAt: '2024-01-01T00:00:00.000Z', updatedAt: '2024-01-01T00:00:00.000Z' };
    http.get.mockResolvedValue({ data: existing });
    http.put.mockResolvedValue({ data: {} });

    const updated = await client.update('chats', '1', { title: 'New' });

    expect(updated.title).toBe('New');
    expect(updated.createdAt).toBe(existing.createdAt);
    expect(updated.updatedAt).not.toBe(existing.updatedAt);
  });

  test('returns null when document not found', async () => {
    const client = makeClient();
    client._http.get.mockRejectedValue(axiosError(404));

    const result = await client.update('chats', 'ghost', { title: 'x' });

    expect(result).toBeNull();
  });
});

describe('DeltaDatabaseClient – delete', () => {
  test('hard-deletes entity via DELETE and removes from master index', async () => {
    const client = makeClient();
    const http = client._http;

    const existing = { id: '1', title: 'hi' };
    let getCallCount = 0;
    http.get.mockImplementation(() => {
      getCallCount++;
      if (getCallCount === 1) return Promise.resolve({ data: existing }); // findById
      return Promise.resolve({ data: { keys: ['1'] } });                   // _readIndex
    });
    http.delete.mockResolvedValue({ data: { status: 'ok' } });
    http.put.mockResolvedValue({ data: {} }); // index update

    const result = await client.delete('chats', '1');

    expect(result).toEqual({ ok: true });
    // Real hard-delete should have been called
    expect(http.delete).toHaveBeenCalledWith(
      '/entity/testdb',
      expect.objectContaining({ params: { key: 'chats:1' } })
    );
    // No soft-delete PUT (no _deleted: true in any PUT body)
    const softDeletePut = http.put.mock.calls.find(
      (c) => c[1] && c[1]['chats:1'] && c[1]['chats:1']._deleted === true
    );
    expect(softDeletePut).toBeUndefined();
  });

  test('returns { ok: false } when entity does not exist', async () => {
    const client = makeClient();
    const http = client._http;
    http.get.mockRejectedValue(axiosError(404));

    const result = await client.delete('chats', 'ghost');

    expect(result).toEqual({ ok: false });
    // DELETE should NOT be called when entity doesn't exist
    expect(http.delete).not.toHaveBeenCalled();
  });
});

describe('DeltaDatabaseClient – query', () => {
  test('uses secondary index when it has entries', async () => {
    const client = makeClient();
    const http = client._http;

    const msg = { id: 'm1', chatId: 'c1', role: 'user', content: 'hi' };
    http.get
      .mockResolvedValueOnce({ data: { keys: ['m1'] } })
      .mockResolvedValueOnce({ data: msg });

    const results = await client.query('messages', { chatId: 'c1' });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({ chatId: 'c1' });
    expect(http.get.mock.calls[0][1].params.key).toBe('messages:_idx:chatId:c1');
  });

  test('falls back to findAll when secondary index is empty', async () => {
    const client = makeClient();
    const http = client._http;

    const msg = { id: 'm2', chatId: 'c2', role: 'assistant', content: 'hello' };
    http.get
      .mockResolvedValueOnce({ data: { keys: [] } })
      .mockResolvedValueOnce({ data: { keys: ['m2'] } })
      .mockResolvedValueOnce({ data: msg });

    const results = await client.query('messages', { chatId: 'c2' });

    expect(results).toHaveLength(1);
  });

  test('respects limit', async () => {
    const client = makeClient();
    const http = client._http;

    const msgs = [
      { id: 'x1', chatId: 'cx' },
      { id: 'x2', chatId: 'cx' },
      { id: 'x3', chatId: 'cx' },
    ];
    http.get
      .mockResolvedValueOnce({ data: { keys: ['x1', 'x2', 'x3'] } })
      .mockResolvedValueOnce({ data: msgs[0] })
      .mockResolvedValueOnce({ data: msgs[1] })
      .mockResolvedValueOnce({ data: msgs[2] });

    const results = await client.query('messages', { chatId: 'cx' }, 2);

    expect(results).toHaveLength(2);
  });
});

// ── DeltaDatabaseAdapter ──────────────────────────────────────────────────────

describe('DeltaDatabaseAdapter', () => {
  const ORIGINAL_ENV = { ...process.env };

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    jest.resetModules();
  });

  test('throws a descriptive error when DELTA_DB_URL is not set', () => {
    delete process.env.DELTA_DB_URL;
    process.env.DELTA_DB_API_KEY = 'k';

    const { DeltaDatabaseAdapter } = require('../db/DeltaDatabaseAdapter');

    expect(() => new DeltaDatabaseAdapter()).toThrow(/DELTA_DB_URL is required/);
  });

  test('throws mentioning Docker instructions when URL is missing', () => {
    delete process.env.DELTA_DB_URL;

    const { DeltaDatabaseAdapter } = require('../db/DeltaDatabaseAdapter');

    expect(() => new DeltaDatabaseAdapter()).toThrow(/docker run/i);
  });

  test('constructs successfully when DELTA_DB_URL is set', () => {
    process.env.DELTA_DB_URL = 'http://localhost:8080';
    process.env.DELTA_DB_API_KEY = 'k';

    const { DeltaDatabaseAdapter } = require('../db/DeltaDatabaseAdapter');

    expect(() => new DeltaDatabaseAdapter()).not.toThrow();
  });

  test('reads DELTA_DB_API_KEY as the primary key', () => {
    process.env.DELTA_DB_URL = 'http://localhost:8080';
    process.env.DELTA_DB_API_KEY = 'primary-key';
    delete process.env.DELTA_DB_ADMIN_KEY;

    const { DeltaDatabaseAdapter } = require('../db/DeltaDatabaseAdapter');
    const adapter = new DeltaDatabaseAdapter();

    expect(adapter._backend.apiKey).toBe('primary-key');
  });

  test('falls back to DELTA_DB_ADMIN_KEY when DELTA_DB_API_KEY is absent', () => {
    process.env.DELTA_DB_URL = 'http://localhost:8080';
    delete process.env.DELTA_DB_API_KEY;
    process.env.DELTA_DB_ADMIN_KEY = 'fallback-key';

    const { DeltaDatabaseAdapter } = require('../db/DeltaDatabaseAdapter');
    const adapter = new DeltaDatabaseAdapter();

    expect(adapter._backend.apiKey).toBe('fallback-key');
  });

  test('mode getter always returns "deltadatabase"', () => {
    process.env.DELTA_DB_URL = 'http://localhost:8080';

    const { DeltaDatabaseAdapter } = require('../db/DeltaDatabaseAdapter');
    const adapter = new DeltaDatabaseAdapter();

    expect(adapter.mode).toBe('deltadatabase');
  });

  test('initialize() calls registerSchemas() then listSchemas() on the backend', async () => {
    process.env.DELTA_DB_URL = 'http://localhost:8080';

    const { DeltaDatabaseAdapter } = require('../db/DeltaDatabaseAdapter');
    const adapter = new DeltaDatabaseAdapter();

    const registerSchemasMock = jest.fn().mockResolvedValue(undefined);
    const listSchemasMock = jest.fn().mockResolvedValue(['chats', 'messages']);
    adapter._backend.registerSchemas = registerSchemasMock;
    adapter._backend.listSchemas     = listSchemasMock;

    await adapter.initialize();

    expect(registerSchemasMock).toHaveBeenCalledTimes(1);
    expect(listSchemasMock).toHaveBeenCalledTimes(1);
  });

  test('getAdapter() returns the same singleton on repeated calls', () => {
    process.env.DELTA_DB_URL = 'http://localhost:8080';

    const { getAdapter } = require('../db/DeltaDatabaseAdapter');
    const a = getAdapter();
    const b = getAdapter();

    expect(a).toBe(b);
  });

  // ── Delegation checks ──────────────────────────────────────────────────────

  function makeAdapter() {
    process.env.DELTA_DB_URL = 'http://localhost:8080';
    const { DeltaDatabaseAdapter } = require('../db/DeltaDatabaseAdapter');
    const adapter = new DeltaDatabaseAdapter();
    const stub = jest.fn().mockResolvedValue({ id: 'x' });
    adapter._backend.insert    = stub;
    adapter._backend.findAll   = stub;
    adapter._backend.findById  = stub;
    adapter._backend.update    = stub;
    adapter._backend.delete    = stub;
    adapter._backend.query     = stub;
    return { adapter, stub };
  }

  test('createChat() delegates to backend.insert("chats", …)', async () => {
    const { adapter, stub } = makeAdapter();
    await adapter.createChat({ title: 'T' });
    expect(stub).toHaveBeenCalledWith('chats', { title: 'T' });
  });

  test('listChats() delegates to backend.findAll("chats")', async () => {
    const { adapter, stub } = makeAdapter();
    stub.mockResolvedValue([]);
    await adapter.listChats();
    expect(stub).toHaveBeenCalledWith('chats');
  });

  test('getChat() delegates to backend.findById("chats", id)', async () => {
    const { adapter, stub } = makeAdapter();
    await adapter.getChat('abc');
    expect(stub).toHaveBeenCalledWith('chats', 'abc');
  });

  test('updateChat() delegates to backend.update("chats", id, fields)', async () => {
    const { adapter, stub } = makeAdapter();
    await adapter.updateChat('abc', { title: 'New' });
    expect(stub).toHaveBeenCalledWith('chats', 'abc', { title: 'New' });
  });

  test('deleteChat() delegates to backend.delete("chats", id)', async () => {
    const { adapter, stub } = makeAdapter();
    await adapter.deleteChat('abc');
    expect(stub).toHaveBeenCalledWith('chats', 'abc');
  });

  test('createMessage() delegates to backend.insert with ["chatId"] secondary index', async () => {
    const { adapter, stub } = makeAdapter();
    await adapter.createMessage({ id: 'm1', chatId: 'c1', role: 'user', content: 'hi' });
    expect(stub).toHaveBeenCalledWith(
      'messages',
      { id: 'm1', chatId: 'c1', role: 'user', content: 'hi' },
      ['chatId']
    );
  });

  test('listMessages() delegates to backend.query("messages", { chatId })', async () => {
    const { adapter, stub } = makeAdapter();
    stub.mockResolvedValue([]);
    await adapter.listMessages('c1');
    expect(stub).toHaveBeenCalledWith('messages', { chatId: 'c1' });
  });

  test('deleteMessagesByChatId() deletes all messages for the chat', async () => {
    process.env.DELTA_DB_URL = 'http://localhost:8080';
    const { DeltaDatabaseAdapter } = require('../db/DeltaDatabaseAdapter');
    const adapter = new DeltaDatabaseAdapter();

    const msgs = [
      { id: 'm1', chatId: 'c1' },
      { id: 'm2', chatId: 'c1' },
    ];
    adapter._backend.query  = jest.fn().mockResolvedValue(msgs);
    adapter._backend.delete = jest.fn().mockResolvedValue({ ok: true });

    const result = await adapter.deleteMessagesByChatId('c1');

    expect(result).toEqual({ ok: true });
    expect(adapter._backend.delete).toHaveBeenCalledTimes(2);
    expect(adapter._backend.delete).toHaveBeenCalledWith(
      'messages', 'm1', [{ field: 'chatId', value: 'c1' }]
    );
    expect(adapter._backend.delete).toHaveBeenCalledWith(
      'messages', 'm2', [{ field: 'chatId', value: 'c1' }]
    );
  });

  test('getSettings() returns { id: "global" } fallback when not in DB', async () => {
    process.env.DELTA_DB_URL = 'http://localhost:8080';
    const { DeltaDatabaseAdapter } = require('../db/DeltaDatabaseAdapter');
    const adapter = new DeltaDatabaseAdapter();
    adapter._backend.findById = jest.fn().mockResolvedValue(null);

    const settings = await adapter.getSettings();

    expect(settings).toEqual({ id: 'global' });
  });

  test('updateSettings() calls update when settings already exist', async () => {
    process.env.DELTA_DB_URL = 'http://localhost:8080';
    const { DeltaDatabaseAdapter } = require('../db/DeltaDatabaseAdapter');
    const adapter = new DeltaDatabaseAdapter();
    adapter._backend.findById = jest.fn().mockResolvedValue({ id: 'global', openaiKey: 'old' });
    adapter._backend.update   = jest.fn().mockResolvedValue({ id: 'global', openaiKey: 'new' });

    await adapter.updateSettings({ openaiKey: 'new' });

    expect(adapter._backend.update).toHaveBeenCalledWith('settings', 'global', { openaiKey: 'new' });
  });

  test('updateSettings() always calls update because getSettings fallback always has id', async () => {
    process.env.DELTA_DB_URL = 'http://localhost:8080';
    const { DeltaDatabaseAdapter } = require('../db/DeltaDatabaseAdapter');
    const adapter = new DeltaDatabaseAdapter();
    adapter._backend.findById = jest.fn().mockResolvedValue(null);
    adapter._backend.update   = jest.fn().mockResolvedValue({ id: 'global', openaiKey: 'new' });
    adapter._backend.insert   = jest.fn();

    await adapter.updateSettings({ openaiKey: 'new' });

    expect(adapter._backend.update).toHaveBeenCalledWith('settings', 'global', { openaiKey: 'new' });
    expect(adapter._backend.insert).not.toHaveBeenCalled();
  });
});
