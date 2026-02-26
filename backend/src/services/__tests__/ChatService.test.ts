'use strict';

import ChatService from '../ChatService';
import type { DeltaDatabaseAdapter, Entity } from '../../db/DeltaDatabaseAdapter';
import type ModelProviderBase from '../../modules/ModelProvider/ModelProviderBase';

interface MockDb {
  createChat: jest.Mock;
  listChats: jest.Mock;
  getChat: jest.Mock;
  updateChat: jest.Mock;
  deleteChat: jest.Mock;
  createMessage: jest.Mock;
  listMessages: jest.Mock;
  deleteMessagesByChatId: jest.Mock;
}

interface MockProvider {
  chat: jest.Mock;
  stream: jest.Mock;
}

describe('ChatService', () => {
  let mockDb: MockDb;
  let mockProvider: MockProvider;
  let service: ChatService;

  const baseChat: Entity = {
    id: 'c1',
    title: 'Test Chat',
    model: null,
    systemPrompt: null,
    knowledgeStoreIds: [],
    webhookId: null,
    metadata: {},
  };

  beforeEach(() => {
    mockDb = {
      createChat:            jest.fn(),
      listChats:             jest.fn().mockResolvedValue([]),
      getChat:               jest.fn(),
      updateChat:            jest.fn().mockResolvedValue({}),
      deleteChat:            jest.fn().mockResolvedValue({ ok: true }),
      createMessage:         jest.fn(),
      listMessages:          jest.fn().mockResolvedValue([]),
      deleteMessagesByChatId: jest.fn().mockResolvedValue({ ok: true }),
    };

    mockProvider = {
      chat:   jest.fn(),
      stream: jest.fn(),
    };

    service = new ChatService({
      db: mockDb as unknown as DeltaDatabaseAdapter,
      getProvider: () => mockProvider as unknown as ModelProviderBase,
    });
  });

  // ── createChat ──────────────────────────────────────────────────────────────

  describe('createChat', () => {
    test('creates a chat with sensible defaults', async () => {
      mockDb.createChat.mockResolvedValue({ id: 'c1', title: 'New Chat' });
      const result = await service.createChat({});
      expect(mockDb.createChat).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'New Chat', knowledgeStoreIds: [], metadata: {} })
      );
      expect(result.id).toBe('c1');
    });

    test('honours provided title and model', async () => {
      mockDb.createChat.mockResolvedValue({});
      await service.createChat({ title: 'My Chat', model: 'gpt-4o' });
      expect(mockDb.createChat).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'My Chat', model: 'gpt-4o' })
      );
    });
  });

  // ── listChats ───────────────────────────────────────────────────────────────

  describe('listChats', () => {
    test('returns chats sorted by updatedAt descending', async () => {
      const chats = [
        { id: 'a', updatedAt: '2024-01-01T00:00:00.000Z' },
        { id: 'b', updatedAt: '2024-01-03T00:00:00.000Z' },
        { id: 'c', updatedAt: '2024-01-02T00:00:00.000Z' },
      ];
      mockDb.listChats.mockResolvedValue(chats);
      const result = await service.listChats();
      expect(result.map((ch) => ch.id)).toEqual(['b', 'c', 'a']);
    });
  });

  // ── getChat ─────────────────────────────────────────────────────────────────

  describe('getChat', () => {
    test('throws 404 when the chat does not exist', async () => {
      mockDb.getChat.mockResolvedValue(null);
      await expect(service.getChat('missing')).rejects.toMatchObject({
        message: expect.stringContaining('Chat not found'),
        status: 404,
      });
    });

    test('returns chat with messages sorted chronologically', async () => {
      mockDb.getChat.mockResolvedValue(baseChat);
      mockDb.listMessages.mockResolvedValue([
        { id: 'm2', role: 'assistant', createdAt: '2024-01-01T00:00:02.000Z' },
        { id: 'm1', role: 'user',      createdAt: '2024-01-01T00:00:01.000Z' },
      ]);
      const result = await service.getChat('c1');
      expect(result.messages[0]!.id).toBe('m1');
      expect(result.messages[1]!.id).toBe('m2');
    });
  });

  // ── updateChat ──────────────────────────────────────────────────────────────

  describe('updateChat', () => {
    test('throws 404 if chat does not exist', async () => {
      mockDb.getChat.mockResolvedValue(null);
      await expect(service.updateChat('missing', { title: 'X' })).rejects.toMatchObject({
        status: 404,
      });
    });

    test('calls db.updateChat with correct args', async () => {
      mockDb.getChat.mockResolvedValue(baseChat);
      mockDb.updateChat.mockResolvedValue({ ...baseChat, title: 'New' });
      const result = await service.updateChat('c1', { title: 'New' });
      expect(mockDb.updateChat).toHaveBeenCalledWith('c1', { title: 'New' });
      expect(result!['title']).toBe('New');
    });
  });

  // ── deleteChat ──────────────────────────────────────────────────────────────

  describe('deleteChat', () => {
    test('throws 404 if chat does not exist', async () => {
      mockDb.getChat.mockResolvedValue(null);
      await expect(service.deleteChat('missing')).rejects.toMatchObject({ status: 404 });
    });

    test('deletes all messages then the chat', async () => {
      mockDb.getChat.mockResolvedValue(baseChat);
      await service.deleteChat('c1');
      expect(mockDb.deleteMessagesByChatId).toHaveBeenCalledWith('c1');
      expect(mockDb.deleteChat).toHaveBeenCalledWith('c1');
    });
  });

  // ── sendMessage ─────────────────────────────────────────────────────────────

  describe('sendMessage', () => {
    beforeEach(() => {
      mockDb.getChat.mockResolvedValue(baseChat);
      mockDb.listMessages.mockResolvedValue([]);
      mockProvider.chat.mockResolvedValue({
        content: 'Hello!',
        model: 'gpt-4o',
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      });
      mockDb.createMessage
        .mockResolvedValueOnce({ id: 'u1', role: 'user',      content: 'Hi' })
        .mockResolvedValueOnce({ id: 'a1', role: 'assistant', content: 'Hello!' });
    });

    test('persists user and assistant messages', async () => {
      const result = await service.sendMessage('c1', 'Hi');
      expect(mockDb.createMessage).toHaveBeenCalledTimes(2);
      expect(result.userMessage['role']).toBe('user');
      expect(result.assistantMessage['role']).toBe('assistant');
    });

    test('throws 404 if chat does not exist', async () => {
      mockDb.getChat.mockResolvedValue(null);
      await expect(service.sendMessage('bad', 'Hi')).rejects.toMatchObject({ status: 404 });
    });

    test('includes system prompt in the messages sent to the provider', async () => {
      mockDb.getChat.mockResolvedValue({ ...baseChat, systemPrompt: 'Be concise.' });
      await service.sendMessage('c1', 'Hi');
      const messages = mockProvider.chat.mock.calls[0]![0] as Array<{ role: string; content: string }>;
      expect(messages[0]).toMatchObject({ role: 'system', content: expect.stringContaining('Be concise.') });
    });

    test('appends chat history before the new user message', async () => {
      mockDb.listMessages.mockResolvedValue([
        { id: 'prev', role: 'user', content: 'Previous', createdAt: '2024-01-01T00:00:00Z' },
      ]);
      await service.sendMessage('c1', 'Follow-up');
      const messages = mockProvider.chat.mock.calls[0]![0] as Array<{ role: string; content: string }>;
      expect(messages).toHaveLength(3);
      expect(messages[1]!.content).toBe('Previous');
      expect(messages[2]!.content).toBe('Follow-up');
    });
  });

  // ── streamMessage ────────────────────────────────────────────────────────────

  describe('streamMessage', () => {
    test('streams chunks and calls onDone with full content', async () => {
      mockDb.getChat.mockResolvedValue(baseChat);
      mockDb.listMessages.mockResolvedValue([]);
      mockDb.createMessage
        .mockResolvedValueOnce({ id: 'u1', role: 'user', content: 'Hi' })
        .mockResolvedValueOnce({ id: 'a1', role: 'assistant', content: 'Hello world' });

      async function* fakeStream() {
        yield 'Hello ';
        yield 'world';
      }
      mockProvider.stream = jest.fn().mockReturnValue(fakeStream());

      const chunks: string[] = [];
      await new Promise<{ full: string; msg: Entity }>((resolve, reject) => {
        void service.streamMessage(
          'c1',
          'Hi',
          {
            onChunk: (c) => chunks.push(c),
            onDone:  (full, msg) => resolve({ full, msg }),
            onError: reject,
          }
        );
      }).then(({ full, msg }) => {
        expect(chunks).toEqual(['Hello ', 'world']);
        expect(full).toBe('Hello world');
        expect(msg['role']).toBe('assistant');
      });
    });

    test('calls onError if chat does not exist', async () => {
      mockDb.getChat.mockResolvedValue(null);
      await new Promise<void>((resolve) => {
        void service.streamMessage('bad', 'Hi', {
          onChunk: () => {},
          onDone:  () => {},
          onError: (err) => {
            expect((err as { status: number }).status).toBe(404);
            resolve();
          },
        });
      });
    });
  });
});
