'use strict';

/**
 * Tests for user-groups member management routes — specifically verifying
 * that both `userIds` and `memberIds` parameter names are accepted.
 */

import { Router } from 'express';

// ── Mock the DeltaDatabaseAdapter ────────────────────────────────────────────

const mockAdapter = {
  getUserGroup: jest.fn(),
  updateUserGroup: jest.fn(),
  listUserGroups: jest.fn(),
  createUserGroup: jest.fn(),
  deleteUserGroup: jest.fn(),
  deleteResourceSharesByTarget: jest.fn(),
};

jest.mock('../../db/DeltaDatabaseAdapter', () => ({
  getAdapter: () => mockAdapter,
}));

jest.mock('../../middleware/auth', () => ({
  requireAuth: (_req: any, _res: any, next: any) => next(),
  requireAdmin: (_req: any, _res: any, next: any) => next(),
}));

// ── Import the router ────────────────────────────────────────────────────────

let router: Router;

beforeAll(async () => {
  const mod = await import('../../routes/user-groups');
  router = mod.default;
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function findHandler(method: string, path: string): Function {
  const layer = (router as any).stack.find(
    (l: any) => l.route?.path === path && l.route?.methods[method]
  );
  if (!layer) throw new Error(`No handler for ${method.toUpperCase()} ${path}`);
  // The handler stack may have auth middleware + the actual handler.
  // We want the last handler in the route stack.
  const handlers = layer.route.stack;
  return handlers[handlers.length - 1].handle;
}

function buildReq(overrides: Record<string, unknown> = {}): any {
  return {
    user: { id: 'admin-1', role: 'admin', email: 'a@test.com', name: 'Admin' },
    params: {},
    body: {},
    ...overrides,
  };
}

function buildRes(): any {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  };
}

describe('user-groups member routes', () => {
  const existingGroup = {
    id: 'g1',
    name: 'Team Alpha',
    memberIds: ['user-1'],
    description: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockAdapter.getUserGroup.mockResolvedValue({ ...existingGroup });
    mockAdapter.updateUserGroup.mockImplementation((_id: string, fields: any) => {
      return Promise.resolve({ ...existingGroup, ...fields });
    });
  });

  // ── POST /:id/members ──────────────────────────────────────────────────

  describe('POST /:id/members', () => {
    test('accepts userIds parameter', async () => {
      const req = buildReq({
        params: { id: 'g1' },
        body: { userIds: ['user-2', 'user-3'] },
      });
      const res = buildRes();
      const next = jest.fn();

      await findHandler('post', '/:id/members').call(null, req, res, next);

      expect(mockAdapter.updateUserGroup).toHaveBeenCalledWith('g1', {
        memberIds: expect.arrayContaining(['user-1', 'user-2', 'user-3']),
      });
      expect(res.json).toHaveBeenCalled();
    });

    test('accepts memberIds parameter (backward compat)', async () => {
      const req = buildReq({
        params: { id: 'g1' },
        body: { memberIds: ['user-4'] },
      });
      const res = buildRes();
      const next = jest.fn();

      await findHandler('post', '/:id/members').call(null, req, res, next);

      expect(mockAdapter.updateUserGroup).toHaveBeenCalledWith('g1', {
        memberIds: expect.arrayContaining(['user-1', 'user-4']),
      });
    });

    test('deduplicates members', async () => {
      const req = buildReq({
        params: { id: 'g1' },
        body: { userIds: ['user-1', 'user-2'] }, // user-1 already exists
      });
      const res = buildRes();

      await findHandler('post', '/:id/members').call(null, req, res, jest.fn());

      const passedMemberIds = mockAdapter.updateUserGroup.mock.calls[0][1].memberIds as string[];
      const uniqueIds = [...new Set(passedMemberIds)];
      expect(passedMemberIds).toEqual(uniqueIds);
    });

    test('returns 400 when no valid array provided', async () => {
      const req = buildReq({
        params: { id: 'g1' },
        body: { something: 'wrong' },
      });
      const res = buildRes();

      await findHandler('post', '/:id/members').call(null, req, res, jest.fn());

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: expect.any(String) }));
    });

    test('returns 404 when group does not exist', async () => {
      mockAdapter.getUserGroup.mockResolvedValue(null);

      const req = buildReq({
        params: { id: 'nope' },
        body: { userIds: ['user-2'] },
      });
      const res = buildRes();

      await findHandler('post', '/:id/members').call(null, req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(404);
    });
  });

  // ── DELETE /:id/members ────────────────────────────────────────────────

  describe('DELETE /:id/members', () => {
    test('accepts userIds parameter', async () => {
      const req = buildReq({
        params: { id: 'g1' },
        body: { userIds: ['user-1'] },
      });
      const res = buildRes();

      await findHandler('delete', '/:id/members').call(null, req, res, jest.fn());

      expect(mockAdapter.updateUserGroup).toHaveBeenCalledWith('g1', {
        memberIds: [],
      });
    });

    test('accepts memberIds parameter (backward compat)', async () => {
      const req = buildReq({
        params: { id: 'g1' },
        body: { memberIds: ['user-1'] },
      });
      const res = buildRes();

      await findHandler('delete', '/:id/members').call(null, req, res, jest.fn());

      expect(mockAdapter.updateUserGroup).toHaveBeenCalledWith('g1', {
        memberIds: [],
      });
    });

    test('returns 400 when no valid array provided', async () => {
      const req = buildReq({
        params: { id: 'g1' },
        body: {},
      });
      const res = buildRes();

      await findHandler('delete', '/:id/members').call(null, req, res, jest.fn());
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
