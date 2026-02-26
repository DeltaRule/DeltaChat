'use strict';

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getAdapter } from '../db/DeltaDatabaseAdapter';

const router = Router();

// GET /api/tools
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter();
    const tools = await db.listTools();
    res.json(tools);
  } catch (err) {
    next(err);
  }
});

// POST /api/tools
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter();
    const body = req.body as Record<string, unknown>;
    const tool = await db.createTool({
      id: uuidv4(),
      name: body['name'] ?? 'Unnamed Tool',
      description: body['description'] ?? null,
      type: body['type'] ?? 'mcp',
      config: body['config'] ?? {},
      enabled: body['enabled'] !== false,
    });
    res.status(201).json(tool);
  } catch (err) {
    next(err);
  }
});

// GET /api/tools/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter();
    const tool = await db.getTool(req.params.id as string);
    if (!tool) return res.status(404).json({ error: 'Tool not found' });
    res.json(tool);
  } catch (err) {
    next(err);
  }
});

// PUT /api/tools/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter();
    const tool = await db.updateTool(req.params.id as string, req.body as Record<string, unknown>);
    if (!tool) return res.status(404).json({ error: 'Tool not found' });
    res.json(tool);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/tools/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter();
    await db.deleteTool(req.params.id as string);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
