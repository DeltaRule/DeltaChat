'use strict';

const MockAdapter = require('axios-mock-adapter');
const { DeltaDatabaseClient } = require('../DeltaDatabaseAdapter');

describe('DeltaDatabaseClient', () => {
  let client;
  let mock;

  beforeEach(() => {
    client = new DeltaDatabaseClient('http://localhost:8080', 'testkey', 'testdb');
    mock = new MockAdapter(client._http);
    mock.onPost('/api/login').reply(200, { token: 'mock-token' });
  });

  afterEach(() => {
    mock.restore();
  });

  // ── Auth ────────────────────────────────────────────────────────────────────

  describe('_ensureToken', () => {
    test('fetches a token on the first call', async () => {
      const token = await client._ensureToken();
      expect(token).toBe('mock-token');
      expect(mock.history.post.length).toBe(1);
    });

    test('caches the token so subsequent calls do not re-login', async () => {
      await client._ensureToken();
      await client._ensureToken();
      expect(mock.history.post.length).toBe(1);
    });

    test('re-fetches when the stored token is already expired', async () => {
      client._token = 'old-token';
      client._tokenExpiry = Date.now() - 1000; // expired 1 s ago
      const token = await client._ensureToken();
      expect(token).toBe('mock-token');
    });

    test('sends adminKey in the login body when available', async () => {
      await client._ensureToken();
      const body = JSON.parse(mock.history.post[0].data);
      expect(body).toEqual({ key: 'testkey' });
    });

    test('falls back to client_id when adminKey is absent', async () => {
      const noKeyClient = new DeltaDatabaseClient('http://localhost:8080', null, 'testdb');
      const noKeyMock = new MockAdapter(noKeyClient._http);
      noKeyMock.onPost('/api/login').reply(200, { token: 'anon-token' });
      await noKeyClient._ensureToken();
      const body = JSON.parse(noKeyMock.history.post[0].data);
      expect(body).toEqual({ client_id: 'deltachat' });
      noKeyMock.restore();
    });
  });

  // ── _put ────────────────────────────────────────────────────────────────────

  describe('_put', () => {
    test('sends PUT /entity/{database} with the entities payload', async () => {
      mock.onPut('/entity/testdb').reply(200);
      await client._put({ 'chats:abc': { id: 'abc', title: 'Test' } });
      expect(mock.history.put.length).toBe(1);
      const body = JSON.parse(mock.history.put[0].data);
      expect(body['chats:abc'].id).toBe('abc');
    });

    test('retries once on 401 by refreshing the token', async () => {
      mock
        .onPut('/entity/testdb').replyOnce(401)
        .onPut('/entity/testdb').reply(200);
      await client._put({ 'k': {} });
      expect(mock.history.put.length).toBe(2);
      expect(mock.history.post.length).toBe(2); // two logins
    });

    test('re-throws non-401 errors', async () => {
      mock.onPut('/entity/testdb').reply(500);
      await expect(client._put({ k: {} })).rejects.toMatchObject({
        response: { status: 500 },
      });
    });
  });

  // ── _get ────────────────────────────────────────────────────────────────────

  describe('_get', () => {
    test('returns the document for a found key', async () => {
      const doc = { id: 'abc', title: 'Hello' };
      mock.onGet('/entity/testdb').reply(200, doc);
      const result = await client._get('chats:abc');
      expect(result).toEqual(doc);
    });

    test('returns null on 404', async () => {
      mock.onGet('/entity/testdb').reply(404);
      const result = await client._get('nonexistent');
      expect(result).toBeNull();
    });

    test('retries once on 401 by refreshing the token', async () => {
      const doc = { id: 'x' };
      mock
        .onGet('/entity/testdb').replyOnce(401)
        .onGet('/entity/testdb').reply(200, doc);
      const result = await client._get('chats:x');
      expect(result).toEqual(doc);
    });

    test('re-throws non-401/404 errors', async () => {
      mock.onGet('/entity/testdb').reply(503);
      await expect(client._get('key')).rejects.toMatchObject({
        response: { status: 503 },
      });
    });
  });

  // ── insert ──────────────────────────────────────────────────────────────────

  describe('insert', () => {
    beforeEach(() => {
      // index GET (empty) + entity PUT + index PUT
      mock.onGet('/entity/testdb').reply(200, { keys: [] });
      mock.onPut('/entity/testdb').reply(200);
    });

    test('creates an entity with the provided id and timestamps', async () => {
      const entity = await client.insert('chats', { id: 'chat-1', title: 'My Chat' });
      expect(entity.id).toBe('chat-1');
      expect(entity.title).toBe('My Chat');
      expect(entity.createdAt).toBeDefined();
      expect(entity.updatedAt).toBeDefined();
    });

    test('generates a uuid when no id is provided', async () => {
      const entity = await client.insert('chats', { title: 'Auto ID' });
      expect(typeof entity.id).toBe('string');
      expect(entity.id.length).toBeGreaterThan(0);
    });

    test('preserves provided createdAt', async () => {
      const createdAt = '2024-01-01T00:00:00.000Z';
      const entity = await client.insert('chats', { id: 'c1', title: 'T', createdAt });
      expect(entity.createdAt).toBe(createdAt);
    });

    test('adds entity id to the master index', async () => {
      await client.insert('chats', { id: 'chat-1', title: 'T' });
      // Second PUT should contain the updated index
      const putCalls = mock.history.put;
      const indexPut = putCalls.find((r) => {
        const body = JSON.parse(r.data);
        return body['chats:_index'] !== undefined;
      });
      expect(indexPut).toBeDefined();
      expect(JSON.parse(indexPut.data)['chats:_index'].keys).toContain('chat-1');
    });

    test('throws when a required non-auto field is missing (schema validation)', async () => {
      await expect(
        client.insert('chats', { id: 'c1' }) // title is required but absent
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  // ── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    test('returns empty array when index is empty', async () => {
      mock.onGet('/entity/testdb').reply(200, { keys: [] });
      const result = await client.findAll('chats');
      expect(result).toEqual([]);
    });

    test('returns all non-deleted entities', async () => {
      mock
        .onGet('/entity/testdb').replyOnce(200, { keys: ['c1', 'c2'] })
        .onGet('/entity/testdb').replyOnce(200, { id: 'c1', title: 'A' })
        .onGet('/entity/testdb').replyOnce(200, { id: 'c2', _deleted: true });
      const result = await client.findAll('chats');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('c1');
    });
  });

  // ── findById ────────────────────────────────────────────────────────────────

  describe('findById', () => {
    test('returns the entity when found', async () => {
      const doc = { id: 'c1', title: 'Chat' };
      mock.onGet('/entity/testdb').reply(200, doc);
      expect(await client.findById('chats', 'c1')).toEqual(doc);
    });

    test('returns null for a soft-deleted entity', async () => {
      mock.onGet('/entity/testdb').reply(200, { id: 'c1', _deleted: true });
      expect(await client.findById('chats', 'c1')).toBeNull();
    });

    test('returns null when the entity does not exist', async () => {
      mock.onGet('/entity/testdb').reply(404);
      expect(await client.findById('chats', 'missing')).toBeNull();
    });
  });

  // ── update ───────────────────────────────────────────────────────────────────

  describe('update', () => {
    test('merges fields and updates updatedAt', async () => {
      const existing = {
        id: 'c1',
        title: 'Old Title',
        createdAt: '2024-01-01T00:00:00.000Z',
        updatedAt: '2024-01-01T00:00:00.000Z',
      };
      mock.onGet('/entity/testdb').reply(200, existing);
      mock.onPut('/entity/testdb').reply(200);

      const updated = await client.update('chats', 'c1', { title: 'New Title' });
      expect(updated.title).toBe('New Title');
      expect(updated.id).toBe('c1');
      expect(updated.createdAt).toBe(existing.createdAt);
      expect(updated.updatedAt).not.toBe(existing.updatedAt);
    });

    test('returns null when entity does not exist', async () => {
      mock.onGet('/entity/testdb').reply(404);
      expect(await client.update('chats', 'missing', { title: 'X' })).toBeNull();
    });
  });

  // ── delete ───────────────────────────────────────────────────────────────────

  describe('delete', () => {
    test('soft-deletes entity and removes it from the master index', async () => {
      const existing = { id: 'c1', title: 'Chat' };
      mock
        .onGet('/entity/testdb').replyOnce(200, existing)          // findById
        .onGet('/entity/testdb').replyOnce(200, { keys: ['c1'] })  // _readIndex
        .onPut('/entity/testdb').reply(200);                       // _put (soft-delete + index)

      const result = await client.delete('chats', 'c1');
      expect(result).toEqual({ ok: true });

      // The first PUT should mark it as deleted
      const deletePut = mock.history.put[0];
      const body = JSON.parse(deletePut.data);
      expect(body['chats:c1']._deleted).toBe(true);
    });

    test('returns { ok: false } when entity does not exist', async () => {
      mock.onGet('/entity/testdb').reply(404);
      expect(await client.delete('chats', 'missing')).toEqual({ ok: false });
    });
  });

  // ── query ────────────────────────────────────────────────────────────────────

  describe('query', () => {
    test('falls back to findAll when no filter is given', async () => {
      mock.onGet('/entity/testdb').reply(200, { keys: [] });
      const result = await client.query('chats', {});
      expect(result).toEqual([]);
    });

    test('uses secondary index when available', async () => {
      const msg = { id: 'm1', chatId: 'c1', role: 'user', content: 'Hi' };
      mock
        .onGet('/entity/testdb').replyOnce(200, { keys: ['m1'] })  // secondary index
        .onGet('/entity/testdb').replyOnce(200, msg);              // fetch entity
      const result = await client.query('messages', { chatId: 'c1' });
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('m1');
    });
  });
});
