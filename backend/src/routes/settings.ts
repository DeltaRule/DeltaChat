'use strict';

import { Router, Request, Response, NextFunction } from 'express';
import { getAdapter } from '../db/DeltaDatabaseAdapter';

const router = Router();

// GET /api/settings
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter();
    const settings = await db.getSettings();
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings
router.put('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter();
    const settings = await db.updateSettings(req.body as Record<string, unknown>);
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

export default router;
