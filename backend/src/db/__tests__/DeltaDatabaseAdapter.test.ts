'use strict';

// Set DELTA_DB_URL before importing the module so that config reads it
process.env['DELTA_DB_URL'] = 'http://localhost:8080';
process.env['DELTA_DB_ADMIN_KEY'] = 'testkey';
process.env['DELTA_DB_DATABASE'] = 'testdb';

import { DeltaDatabaseAdapter } from '../DeltaDatabaseAdapter';

describe('DeltaDatabaseAdapter', () => {
  // ── Constructor ──────────────────────────────────────────────────────────────

  describe('constructor', () => {
    test('throws if DELTA_DB_URL is not set', () => {
      jest.resetModules();
      const savedUrl = process.env['DELTA_DB_URL'];
      delete process.env['DELTA_DB_URL'];
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DeltaDatabaseAdapter: Adapter } = require('../DeltaDatabaseAdapter') as { DeltaDatabaseAdapter: new () => DeltaDatabaseAdapter };
      expect(() => new Adapter()).toThrow('DELTA_DB_URL is required');
      process.env['DELTA_DB_URL'] = savedUrl;
      jest.resetModules();
    });

    test('throws if DELTA_DB_ADMIN_KEY is not set', () => {
      jest.resetModules();
      const savedKey = process.env['DELTA_DB_ADMIN_KEY'];
      delete process.env['DELTA_DB_ADMIN_KEY'];
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { DeltaDatabaseAdapter: Adapter } = require('../DeltaDatabaseAdapter') as { DeltaDatabaseAdapter: new () => DeltaDatabaseAdapter };
      expect(() => new Adapter()).toThrow('DELTA_DB_ADMIN_KEY is required');
      process.env['DELTA_DB_ADMIN_KEY'] = savedKey;
      jest.resetModules();
    });

    test('mode always returns "deltadatabase"', () => {
      const adapter = new DeltaDatabaseAdapter();
      expect(adapter.mode).toBe('deltadatabase');
    });
  });

  // ── Collection methods ────────────────────────────────────────────────────────

  describe('collection methods', () => {
    let adapter: DeltaDatabaseAdapter;
    let mockBackend: {
      insert: jest.Mock;
      findAll: jest.Mock;
      findById: jest.Mock;
      update: jest.Mock;
      delete: jest.Mock;
      query: jest.Mock;
    };

    beforeEach(() => {
      adapter = new DeltaDatabaseAdapter();
      mockBackend = {
        insert:   jest.fn(),
        findAll:  jest.fn(),
        findById: jest.fn(),
        update:   jest.fn(),
        delete:   jest.fn(),
        query:    jest.fn(),
      };
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (adapter as any)._backend = mockBackend;
    });

    // ── Chats ──────────────────────────────────────────────────────────────────

    test('createChat delegates to backend.insert("chats", doc)', async () => {
      const doc = { id: 'c1', title: 'Chat' };
      mockBackend.insert.mockResolvedValue(doc);
      await adapter.createChat(doc);
      expect(mockBackend.insert).toHaveBeenCalledWith('chats', doc);
    });

    test('listChats delegates to backend.findAll("chats")', async () => {
      mockBackend.findAll.mockResolvedValue([]);
      await adapter.listChats();
      expect(mockBackend.findAll).toHaveBeenCalledWith('chats');
    });

    test('getChat delegates to backend.findById("chats", id)', async () => {
      mockBackend.findById.mockResolvedValue(null);
      await adapter.getChat('c1');
      expect(mockBackend.findById).toHaveBeenCalledWith('chats', 'c1');
    });

    test('updateChat delegates to backend.update("chats", id, fields)', async () => {
      mockBackend.update.mockResolvedValue({});
      await adapter.updateChat('c1', { title: 'New' });
      expect(mockBackend.update).toHaveBeenCalledWith('chats', 'c1', { title: 'New' });
    });

    test('deleteChat delegates to backend.delete("chats", id)', async () => {
      mockBackend.delete.mockResolvedValue({ ok: true });
      await adapter.deleteChat('c1');
      expect(mockBackend.delete).toHaveBeenCalledWith('chats', 'c1');
    });

    // ── Messages ───────────────────────────────────────────────────────────────

    test('createMessage inserts with ["chatId"] secondary index', async () => {
      const msg = { id: 'm1', chatId: 'c1', role: 'user', content: 'Hi' };
      mockBackend.insert.mockResolvedValue(msg);
      await adapter.createMessage(msg);
      expect(mockBackend.insert).toHaveBeenCalledWith('messages', msg, ['chatId']);
    });

    test('listMessages queries by chatId', async () => {
      mockBackend.query.mockResolvedValue([]);
      await adapter.listMessages('c1');
      expect(mockBackend.query).toHaveBeenCalledWith('messages', { chatId: 'c1' });
    });

    test('deleteMessagesByChatId deletes each message and prunes secondary index', async () => {
      const msgs = [
        { id: 'm1', chatId: 'c1' },
        { id: 'm2', chatId: 'c1' },
      ];
      mockBackend.query.mockResolvedValue(msgs);
      mockBackend.delete.mockResolvedValue({ ok: true });

      await adapter.deleteMessagesByChatId('c1');

      expect(mockBackend.delete).toHaveBeenCalledTimes(2);
      expect(mockBackend.delete).toHaveBeenCalledWith(
        'messages', 'm1', [{ field: 'chatId', value: 'c1' }]
      );
    });

    // ── Knowledge Stores ───────────────────────────────────────────────────────

    test('createKnowledgeStore delegates to backend.insert("knowledge_stores", doc)', async () => {
      const ks = { id: 'ks1', name: 'Docs' };
      mockBackend.insert.mockResolvedValue(ks);
      await adapter.createKnowledgeStore(ks);
      expect(mockBackend.insert).toHaveBeenCalledWith('knowledge_stores', ks);
    });

    test('listKnowledgeStores delegates to backend.findAll', async () => {
      mockBackend.findAll.mockResolvedValue([]);
      await adapter.listKnowledgeStores();
      expect(mockBackend.findAll).toHaveBeenCalledWith('knowledge_stores');
    });

    test('deleteKnowledgeStore delegates to backend.delete', async () => {
      mockBackend.delete.mockResolvedValue({ ok: true });
      await adapter.deleteKnowledgeStore('ks1');
      expect(mockBackend.delete).toHaveBeenCalledWith('knowledge_stores', 'ks1');
    });

    // ── Documents ──────────────────────────────────────────────────────────────

    test('createDocument inserts with ["knowledgeStoreId"] secondary index', async () => {
      const doc = { id: 'd1', knowledgeStoreId: 'ks1', filename: 'f.pdf' };
      mockBackend.insert.mockResolvedValue(doc);
      await adapter.createDocument(doc);
      expect(mockBackend.insert).toHaveBeenCalledWith('documents', doc, ['knowledgeStoreId']);
    });

    test('listDocuments queries by knowledgeStoreId', async () => {
      mockBackend.query.mockResolvedValue([]);
      await adapter.listDocuments('ks1');
      expect(mockBackend.query).toHaveBeenCalledWith('documents', { knowledgeStoreId: 'ks1' });
    });

    // ── Webhooks ───────────────────────────────────────────────────────────────

    test('createWebhook delegates to backend.insert("webhooks", doc)', async () => {
      const wh = { id: 'w1', name: 'Hook', url: 'https://example.com' };
      mockBackend.insert.mockResolvedValue(wh);
      await adapter.createWebhook(wh);
      expect(mockBackend.insert).toHaveBeenCalledWith('webhooks', wh);
    });

    // ── Settings ───────────────────────────────────────────────────────────────

    test('getSettings returns { id: "global" } when no record exists', async () => {
      mockBackend.findById.mockResolvedValue(null);
      const result = await adapter.getSettings();
      expect(result).toEqual({ id: 'global' });
    });

    test('getSettings returns the stored record when it exists', async () => {
      const stored = { id: 'global', theme: 'dark' };
      mockBackend.findById.mockResolvedValue(stored);
      expect(await adapter.getSettings()).toEqual(stored);
    });

    test('updateSettings inserts when no existing record', async () => {
      mockBackend.findById.mockResolvedValue(null);
      mockBackend.insert.mockResolvedValue({ id: 'global', theme: 'dark' });
      await adapter.updateSettings({ theme: 'dark' });
      expect(mockBackend.insert).toHaveBeenCalledWith(
        'settings', { id: 'global', theme: 'dark' }
      );
    });

    test('updateSettings updates when a record already exists', async () => {
      mockBackend.findById.mockResolvedValue({ id: 'global' });
      mockBackend.update.mockResolvedValue({ id: 'global', theme: 'light' });
      await adapter.updateSettings({ theme: 'light' });
      expect(mockBackend.update).toHaveBeenCalledWith('settings', 'global', { theme: 'light' });
    });
  });
});
