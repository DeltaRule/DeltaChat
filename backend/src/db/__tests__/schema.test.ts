'use strict';

import { SCHEMAS, validate } from '../schema';

describe('SCHEMAS', () => {
  test('defines entries for all expected collections', () => {
    const collections = [
      'chats',
      'messages',
      'knowledge_stores',
      'documents',
      'webhooks',
      'settings',
    ];
    for (const col of collections) {
      expect(SCHEMAS[col]).toBeDefined();
      expect(Array.isArray(SCHEMAS[col]!.required)).toBe(true);
      expect(typeof SCHEMAS[col]!.fields).toBe('object');
    }
  });

  test('chats requires id and title', () => {
    expect(SCHEMAS['chats']!.required).toContain('id');
    expect(SCHEMAS['chats']!.required).toContain('title');
  });

  test('messages requires id, chatId, role, and content', () => {
    expect(SCHEMAS['messages']!.required).toEqual(
      expect.arrayContaining(['id', 'chatId', 'role', 'content'])
    );
  });

  test('documents requires id, knowledgeStoreId, and filename', () => {
    expect(SCHEMAS['documents']!.required).toEqual(
      expect.arrayContaining(['id', 'knowledgeStoreId', 'filename'])
    );
  });

  test('webhooks requires id, name, and url', () => {
    expect(SCHEMAS['webhooks']!.required).toEqual(
      expect.arrayContaining(['id', 'name', 'url'])
    );
  });
});

describe('validate', () => {
  describe('chats', () => {
    test('passes when all required fields are present', () => {
      expect(() => validate('chats', { id: 'c1', title: 'My Chat' })).not.toThrow();
    });

    test('throws when id is missing', () => {
      expect(() => validate('chats', { title: 'My Chat' })).toThrow(/"id"/);
    });

    test('throws when title is missing', () => {
      expect(() => validate('chats', { id: 'c1' })).toThrow(/"title"/);
    });

    test('throws when title is null', () => {
      expect(() => validate('chats', { id: 'c1', title: null })).toThrow(/"title"/);
    });

    test('error has status 400', () => {
      let err: unknown;
      try { validate('chats', { id: 'c1' }); } catch (e) { err = e; }
      expect((err as { status: number }).status).toBe(400);
    });
  });

  describe('messages', () => {
    const valid = { id: 'm1', chatId: 'c1', role: 'user', content: 'Hello' };

    test('passes for a valid message', () => {
      expect(() => validate('messages', valid)).not.toThrow();
    });

    test('throws when content is missing', () => {
      const { content: _c, ...rest } = valid;
      expect(() => validate('messages', rest)).toThrow(/"content"/);
    });

    test('throws when chatId is missing', () => {
      const { chatId: _i, ...rest } = valid;
      expect(() => validate('messages', rest)).toThrow(/"chatId"/);
    });
  });

  describe('knowledge_stores', () => {
    test('passes for a valid knowledge store', () => {
      expect(() => validate('knowledge_stores', { id: 'ks1', name: 'Docs' })).not.toThrow();
    });

    test('throws when name is missing', () => {
      expect(() => validate('knowledge_stores', { id: 'ks1' })).toThrow(/"name"/);
    });
  });

  describe('documents', () => {
    test('passes for a valid document', () => {
      expect(() =>
        validate('documents', { id: 'd1', knowledgeStoreId: 'ks1', filename: 'doc.pdf' })
      ).not.toThrow();
    });

    test('throws when knowledgeStoreId is missing', () => {
      expect(() =>
        validate('documents', { id: 'd1', filename: 'doc.pdf' })
      ).toThrow(/"knowledgeStoreId"/);
    });
  });

  describe('webhooks', () => {
    test('passes for a valid webhook', () => {
      expect(() =>
        validate('webhooks', { id: 'w1', name: 'My Hook', url: 'https://example.com' })
      ).not.toThrow();
    });

    test('throws when url is missing', () => {
      expect(() => validate('webhooks', { id: 'w1', name: 'Hook' })).toThrow(/"url"/);
    });
  });

  describe('settings', () => {
    test('passes for a valid settings record', () => {
      expect(() => validate('settings', { id: 'global' })).not.toThrow();
    });

    test('throws when id is missing', () => {
      expect(() => validate('settings', {})).toThrow(/"id"/);
    });
  });

  test('does not throw for an unknown collection', () => {
    expect(() => validate('unknown_collection', {})).not.toThrow();
  });
});
