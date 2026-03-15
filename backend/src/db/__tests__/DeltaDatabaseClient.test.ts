'use strict';

import MockAdapter from 'axios-mock-adapter';
import { DeltaDatabaseClient } from '../DeltaDatabaseAdapter';

describe('DeltaDatabaseClient', () => {
  let client: DeltaDatabaseClient;
  let mock: MockAdapter;

  beforeEach(() => {
    client = new DeltaDatabaseClient('http://localhost:8080', 'testkey', 'testdb');
    mock = new MockAdapter(client._http);
  });

  afterEach(() => {
    mock.restore();
  });

  // ── Schema ID ───────────────────────────────────────────────────────────────

  describe('_schemaId', () => {
    test('builds schema_id as {dbPrefix}.{collection}', () => {
      expect(client._schemaId('chats')).toBe('testdb.chats');
      expect(client._schemaId('messages')).toBe('testdb.messages');
    });

    test('returns collection name when dbPrefix is empty', () => {
      const noPrefixClient = new DeltaDatabaseClient('http://localhost:8080', 'testkey', '');
      expect(noPrefixClient._schemaId('chats')).toBe('chats');
    });
  });

  // ── Auth ────────────────────────────────────────────────────────────────────

  describe('auth', () => {
    test('uses the API key directly as Bearer token (no login call)', async () => {
      mock.onGet('/entity/testdb.chats').reply(200, { id: 'c1', title: 'Test' });
      await client._get('chats', 'c1');
      // No POST to /api/login should have been made
      expect(mock.history['post']!.length).toBe(0);
      // Bearer header should contain the raw API key
      const authHeader = mock.history['get']![0]!.headers!['Authorization'];
      expect(authHeader).toBe('Bearer testkey');
    });
  });

  // ── _put ────────────────────────────────────────────────────────────────────

  describe('_put', () => {
    test('sends PUT /entity/{schema_id} with the entities payload', async () => {
      mock.onPut('/entity/testdb.chats').reply(200);
      await client._put('chats', { abc: { id: 'abc', title: 'Test' } });
      expect(mock.history['put']!.length).toBe(1);
      const body = JSON.parse(mock.history['put']![0]!.data as string) as Record<string, unknown>;
      expect((body['abc'] as Record<string, unknown>)['id']).toBe('abc');
    });

    test('re-throws errors', async () => {
      mock.onPut('/entity/testdb.chats').reply(500);
      await expect(client._put('chats', { k: {} })).rejects.toMatchObject({
        response: { status: 500 },
      });
    });
  });

  // ── _get ────────────────────────────────────────────────────────────────────

  describe('_get', () => {
    test('returns the document for a found key', async () => {
      const doc = { id: 'abc', title: 'Hello' };
      mock.onGet('/entity/testdb.chats').reply(200, doc);
      const result = await client._get('chats', 'abc');
      expect(result).toEqual(doc);
    });

    test('returns null on 404', async () => {
      mock.onGet('/entity/testdb.chats').reply(404);
      const result = await client._get('chats', 'nonexistent');
      expect(result).toBeNull();
    });

    test('re-throws non-404 errors', async () => {
      mock.onGet('/entity/testdb.chats').reply(503);
      await expect(client._get('chats', 'key')).rejects.toMatchObject({
        response: { status: 503 },
      });
    });
  });

  // ── Schema management ───────────────────────────────────────────────────────

  describe('schema management', () => {
    test('listSchemas calls GET /admin/schemas', async () => {
      mock.onGet('/admin/schemas').reply(200, ['testdb.chats', 'testdb.messages']);
      const schemas = await client.listSchemas();
      expect(schemas).toEqual(['testdb.chats', 'testdb.messages']);
    });

    test('getSchema returns schema document', async () => {
      const schema = { $schema: 'http://json-schema.org/draft-07/schema#', type: 'object' };
      mock.onGet('/schema/testdb.chats').reply(200, schema);
      const result = await client.getSchema('testdb.chats');
      expect(result).toEqual(schema);
    });

    test('getSchema returns null on 404', async () => {
      mock.onGet('/schema/testdb.missing').reply(404);
      const result = await client.getSchema('testdb.missing');
      expect(result).toBeNull();
    });

    test('putSchema sends PUT /schema/{schemaID}', async () => {
      mock.onPut('/schema/testdb.chats').reply(200, { status: 'ok' });
      const schema = { $schema: 'http://json-schema.org/draft-07/schema#', type: 'object' };
      await client.putSchema('testdb.chats', schema);
      expect(mock.history['put']!.length).toBe(1);
    });
  });

  // ── insert ──────────────────────────────────────────────────────────────────

  describe('insert', () => {
    beforeEach(() => {
      mock.onGet('/entity/testdb.chats').reply(200, { keys: [] });
      mock.onPut('/entity/testdb.chats').reply(200);
    });

    test('creates an entity with the provided id and timestamps', async () => {
      const entity = await client.insert('chats', { id: 'chat-1', title: 'My Chat' });
      expect(entity.id).toBe('chat-1');
      expect(entity['title']).toBe('My Chat');
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
      const putCalls = mock.history['put']!;
      const indexPut = putCalls.find((r) => {
        const body = JSON.parse(r.data as string) as Record<string, unknown>;
        return body['_index'] !== undefined;
      });
      expect(indexPut).toBeDefined();
      const indexBody = JSON.parse(indexPut!.data as string) as Record<string, { keys: string[] }>;
      expect(indexBody['_index']!.keys).toContain('chat-1');
    });

    test('throws when a required non-auto field is missing (schema validation)', async () => {
      await expect(
        client.insert('chats', { id: 'c1' })
      ).rejects.toMatchObject({ status: 400 });
    });
  });

  // ── findAll ─────────────────────────────────────────────────────────────────

  describe('findAll', () => {
    test('returns empty array when index is empty', async () => {
      mock.onGet('/entity/testdb.chats').reply(200, { keys: [] });
      const result = await client.findAll('chats');
      expect(result).toEqual([]);
    });

    test('returns all entities listed in the index', async () => {
      mock
        .onGet('/entity/testdb.chats').replyOnce(200, { keys: ['c1', 'c2'] })
        .onGet('/entity/testdb.chats').replyOnce(200, { id: 'c1', title: 'A' })
        .onGet('/entity/testdb.chats').replyOnce(200, { id: 'c2', title: 'B' });
      const result = await client.findAll('chats');
      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe('c1');
      expect(result[1]!.id).toBe('c2');
    });
  });

  // ── findById ────────────────────────────────────────────────────────────────

  describe('findById', () => {
    test('returns the entity when found', async () => {
      const doc = { id: 'c1', title: 'Chat' };
      mock.onGet('/entity/testdb.chats').reply(200, doc);
      expect(await client.findById('chats', 'c1')).toEqual(doc);
    });

    test('returns null when the entity does not exist', async () => {
      mock.onGet('/entity/testdb.chats').reply(404);
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
      mock.onGet('/entity/testdb.chats').reply(200, existing);
      mock.onPut('/entity/testdb.chats').reply(200);

      const updated = await client.update('chats', 'c1', { title: 'New Title' });
      expect(updated!['title']).toBe('New Title');
      expect(updated!.id).toBe('c1');
      expect(updated!.createdAt).toBe(existing.createdAt);
      expect(updated!.updatedAt).not.toBe(existing.updatedAt);
    });

    test('returns null when entity does not exist', async () => {
      mock.onGet('/entity/testdb.chats').reply(404);
      expect(await client.update('chats', 'missing', { title: 'X' })).toBeNull();
    });
  });

  // ── delete ───────────────────────────────────────────────────────────────────

  describe('delete', () => {
    test('uses DELETE endpoint and removes entity from the master index', async () => {
      const existing = { id: 'c1', title: 'Chat' };
      mock
        .onGet('/entity/testdb.chats').replyOnce(200, existing)
        .onDelete('/entity/testdb.chats').reply(200)
        .onGet('/entity/testdb.chats').replyOnce(200, { keys: ['c1'] })
        .onPut('/entity/testdb.chats').reply(200);

      const result = await client.delete('chats', 'c1');
      expect(result).toEqual({ ok: true });

      // Should have called DELETE, not PUT with _deleted
      expect(mock.history['delete']!.length).toBe(1);
    });

    test('returns { ok: false } when entity does not exist', async () => {
      mock.onGet('/entity/testdb.chats').reply(404);
      expect(await client.delete('chats', 'missing')).toEqual({ ok: false });
    });
  });

  // ── query ────────────────────────────────────────────────────────────────────

  describe('query', () => {
    test('falls back to findAll when no filter is given', async () => {
      mock.onGet('/entity/testdb.chats').reply(200, { keys: [] });
      const result = await client.query('chats', {});
      expect(result).toEqual([]);
    });

    test('uses secondary index when available', async () => {
      const msg = { id: 'm1', chatId: 'c1', role: 'user', content: 'Hi' };
      mock
        .onGet('/entity/testdb.messages').replyOnce(200, { keys: ['m1'] })
        .onGet('/entity/testdb.messages').replyOnce(200, msg);
      const result = await client.query('messages', { chatId: 'c1' });
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe('m1');
    });
  });
});
