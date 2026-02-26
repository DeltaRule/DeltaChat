'use strict';

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getAdapter } from '../db/DeltaDatabaseAdapter';

const router = Router();

// GET /api/agents
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter();
    const agents = await db.listAgents();
    res.json(agents);
  } catch (err) {
    next(err);
  }
});

// POST /api/agents
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter();
    const body = req.body as Record<string, unknown>;
    const agent = await db.createAgent({
      id: uuidv4(),
      name: body['name'] ?? 'Unnamed Agent',
      description: body['description'] ?? null,
      systemPrompt: body['systemPrompt'] ?? '',
      provider: body['provider'] ?? null,
      providerModel: body['providerModel'] ?? null,
      knowledgeStoreIds: body['knowledgeStoreIds'] ?? [],
      toolIds: body['toolIds'] ?? [],
      temperature: body['temperature'] ?? null,
      maxTokens: body['maxTokens'] ?? null,
    });
    res.status(201).json(agent);
  } catch (err) {
    next(err);
  }
});

// GET /api/agents/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter();
    const agent = await db.getAgent(req.params.id as string);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json(agent);
  } catch (err) {
    next(err);
  }
});

// PUT /api/agents/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter();
    const agent = await db.updateAgent(req.params.id as string, req.body as Record<string, unknown>);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    res.json(agent);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/agents/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter();
    await db.deleteAgent(req.params.id as string);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
