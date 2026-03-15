'use strict';

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { getAdapter } from '../db/DeltaDatabaseAdapter';
import { getAuthService } from '../services/AuthService';

const router = Router();

router.use(requireAuth, requireAdmin);

// GET /api/users
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter();
    const authService = getAuthService();
    const users = await db.listUsers();
    res.json(users.map((u) => authService._sanitizeUser(u)));
  } catch (err) {
    next(err);
  }
});

// GET /api/users/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter();
    const user = await db.getUserById(req.params.id as string);
    if (!user) return res.status(404).json({ error: 'User not found' });
    const authService = getAuthService();
    res.json(authService._sanitizeUser(user));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/:id/role
router.patch('/:id/role', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { role } = req.body as Record<string, string>;
    if (role !== 'admin' && role !== 'user') {
      return res.status(400).json({ error: 'role must be "admin" or "user"' });
    }
    // Prevent demoting yourself
    if (req.params.id === req.user!.id && role !== 'admin') {
      return res.status(400).json({ error: 'Cannot demote yourself' });
    }
    const db = getAdapter();
    const user = await db.updateUser(req.params.id as string, { role });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const authService = getAuthService();
    res.json(authService._sanitizeUser(user));
  } catch (err) {
    next(err);
  }
});

// PATCH /api/users/:id/disable
router.patch('/:id/disable', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { disabled } = req.body as Record<string, boolean>;
    // Prevent disabling yourself
    if (req.params.id === req.user!.id) {
      return res.status(400).json({ error: 'Cannot disable yourself' });
    }
    const db = getAdapter();
    const user = await db.updateUser(req.params.id as string, { disabled: !!disabled });
    if (!user) return res.status(404).json({ error: 'User not found' });
    const authService = getAuthService();
    res.json(authService._sanitizeUser(user));
  } catch (err) {
    next(err);
  }
});

// DELETE /api/users/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (req.params.id === req.user!.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    const db = getAdapter();
    // Cascade: remove from groups
    const groups = await db.getUserGroupsForUser(req.params.id as string);
    for (const g of groups) {
      const members = (g['memberIds'] as string[]).filter((m) => m !== req.params.id);
      await db.updateUserGroup(g.id, { memberIds: members });
    }
    // Cascade: remove direct shares to this user
    await db.deleteResourceSharesByTarget('user', req.params.id as string);
    await db.deleteUser(req.params.id as string);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
