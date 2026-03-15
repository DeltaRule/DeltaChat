'use strict';

/**
 * Tests for chat route authorization — verifying that users can only
 * access their own chats and admins can access any chat.
 *
 * These tests exercise the route-level helper `canAccessChat` and the
 * middleware behavior by simulating Express request/response objects.
 */

import { Router } from 'express';

// ── Build a minimal mock of the ChatService used by routes ───────────────

const mockChatService = {
  createChat: jest.fn(),
  listChats: jest.fn(),
  getChat: jest.fn(),
  updateChat: jest.fn(),
  deleteChat: jest.fn(),
  sendMessage: jest.fn(),
  streamMessage: jest.fn(),
};

const mockWebhookService = { notify: jest.fn().mockResolvedValue(undefined) };

// ── Helpers to build Express-like req/res/next ───────────────────────────

function buildReq(overrides: Record<string, unknown> = {}): any {
  return {
    user: { id: 'user-1', role: 'user', email: 'test@test.com', name: 'Test' },
    params: {},
    body: {},
    headers: {},
    services: {
      chatService: mockChatService,
      webhookService: mockWebhookService,
    },
    ...overrides,
  };
}

function buildRes(): any {
  const res: any = {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
    setHeader: jest.fn(),
    flushHeaders: jest.fn(),
    write: jest.fn(),
    end: jest.fn(),
  };
  return res;
}

// ── Import the chat router (after mocks are set up) ──────────────────────

// We import dynamically so the module picks up our mocks
let chatRouter: Router;

beforeAll(async () => {
  const mod = await import('../../routes/chat');
  chatRouter = mod.default;
});

// ── Helper to find and call the registered route handler ─────────────────

function findHandler(method: string, path: string): Function {
  const layer = (chatRouter as any).stack.find(
    (l: any) => l.route?.path === path && l.route?.methods[method]
  );
  if (!layer) throw new Error(`No handler for ${method.toUpperCase()} ${path}`);
  return layer.route.stack[0].handle;
}

describe('Chat Route Authorization', () => {
  beforeEach(() => jest.clearAllMocks());

  // ── GET /api/chats (list) ──────────────────────────────────────────────

  describe('GET / (list chats)', () => {
    test('regular user sees only their own chats', async () => {
      const chats = [
        { id: 'c1', ownerId: 'user-1', title: 'Mine' },
        { id: 'c2', ownerId: 'user-2', title: 'Theirs' },
        { id: 'c3', title: 'Legacy (no owner)' },
      ];
      mockChatService.listChats.mockResolvedValue(chats);

      const req = buildReq();
      const res = buildRes();
      const next = jest.fn();

      await findHandler('get', '/').call(null, req, res, next);

      expect(res.json).toHaveBeenCalledWith([
        expect.objectContaining({ id: 'c1' }),
      ]);
      // Legacy and other user's chats excluded
      const returned = res.json.mock.calls[0][0];
      expect(returned.find((c: any) => c.id === 'c2')).toBeUndefined();
      expect(returned.find((c: any) => c.id === 'c3')).toBeUndefined();
    });

    test('admin sees all chats including legacy', async () => {
      const chats = [
        { id: 'c1', ownerId: 'user-1', title: 'Theirs' },
        { id: 'c2', ownerId: 'admin-1', title: 'Mine' },
        { id: 'c3', title: 'Legacy' },
      ];
      mockChatService.listChats.mockResolvedValue(chats);

      const req = buildReq({ user: { id: 'admin-1', role: 'admin', email: 'a@test.com', name: 'Admin' } });
      const res = buildRes();

      await findHandler('get', '/').call(null, req, res, jest.fn());

      const returned = res.json.mock.calls[0][0];
      expect(returned).toHaveLength(3);
    });
  });

  // ── GET /api/chats/:id ─────────────────────────────────────────────────

  describe('GET /:id (get single chat)', () => {
    test('owner can access their chat', async () => {
      mockChatService.getChat.mockResolvedValue({ id: 'c1', ownerId: 'user-1', title: 'Mine' });

      const req = buildReq({ params: { id: 'c1' } });
      const res = buildRes();

      await findHandler('get', '/:id').call(null, req, res, jest.fn());

      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }));
      expect(res.status).not.toHaveBeenCalledWith(403);
    });

    test('non-owner gets 403', async () => {
      mockChatService.getChat.mockResolvedValue({ id: 'c2', ownerId: 'user-2', title: 'Theirs' });

      const req = buildReq({ params: { id: 'c2' } });
      const res = buildRes();

      await findHandler('get', '/:id').call(null, req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    });

    test('admin can access any chat', async () => {
      mockChatService.getChat.mockResolvedValue({ id: 'c2', ownerId: 'user-2', title: 'Theirs' });

      const req = buildReq({
        params: { id: 'c2' },
        user: { id: 'admin-1', role: 'admin', email: 'a@test.com', name: 'Admin' },
      });
      const res = buildRes();

      await findHandler('get', '/:id').call(null, req, res, jest.fn());
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ id: 'c2' }));
    });

    test('returns 404 for non-existent chat', async () => {
      mockChatService.getChat.mockResolvedValue(null);

      const req = buildReq({ params: { id: 'non-existent' } });
      const res = buildRes();

      await findHandler('get', '/:id').call(null, req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(404);
    });

    test('legacy chat without ownerId gives 403 to regular user', async () => {
      mockChatService.getChat.mockResolvedValue({ id: 'c3', title: 'Legacy' });

      const req = buildReq({ params: { id: 'c3' } });
      const res = buildRes();

      await findHandler('get', '/:id').call(null, req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(403);
    });
  });

  // ── PATCH /api/chats/:id ───────────────────────────────────────────────

  describe('PATCH /:id (update chat)', () => {
    test('owner can update their chat', async () => {
      mockChatService.getChat.mockResolvedValue({ id: 'c1', ownerId: 'user-1', title: 'Mine' });
      mockChatService.updateChat.mockResolvedValue({ id: 'c1', title: 'Updated' });

      const req = buildReq({ params: { id: 'c1' }, body: { title: 'Updated' } });
      const res = buildRes();

      await findHandler('patch', '/:id').call(null, req, res, jest.fn());
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ title: 'Updated' }));
    });

    test('non-owner gets 403 on update', async () => {
      mockChatService.getChat.mockResolvedValue({ id: 'c2', ownerId: 'user-2', title: 'Theirs' });

      const req = buildReq({ params: { id: 'c2' }, body: { title: 'Hacked' } });
      const res = buildRes();

      await findHandler('patch', '/:id').call(null, req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockChatService.updateChat).not.toHaveBeenCalled();
    });
  });

  // ── DELETE /api/chats/:id ──────────────────────────────────────────────

  describe('DELETE /:id (delete chat)', () => {
    test('owner can delete their chat', async () => {
      mockChatService.getChat.mockResolvedValue({ id: 'c1', ownerId: 'user-1' });
      mockChatService.deleteChat.mockResolvedValue({ ok: true });

      const req = buildReq({ params: { id: 'c1' } });
      const res = buildRes();

      await findHandler('delete', '/:id').call(null, req, res, jest.fn());
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });

    test('non-owner gets 403 on delete', async () => {
      mockChatService.getChat.mockResolvedValue({ id: 'c2', ownerId: 'user-2' });

      const req = buildReq({ params: { id: 'c2' } });
      const res = buildRes();

      await findHandler('delete', '/:id').call(null, req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(403);
      expect(mockChatService.deleteChat).not.toHaveBeenCalled();
    });

    test('admin can delete any chat', async () => {
      mockChatService.getChat.mockResolvedValue({ id: 'c2', ownerId: 'user-2' });
      mockChatService.deleteChat.mockResolvedValue({ ok: true });

      const req = buildReq({
        params: { id: 'c2' },
        user: { id: 'admin-1', role: 'admin', email: 'a@test.com', name: 'Admin' },
      });
      const res = buildRes();

      await findHandler('delete', '/:id').call(null, req, res, jest.fn());
      expect(res.json).toHaveBeenCalledWith({ ok: true });
    });
  });
});
