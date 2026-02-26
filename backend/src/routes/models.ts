'use strict';

import { Router, Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { getAdapter } from '../db/DeltaDatabaseAdapter';

const router = Router();

// GET /api/models
router.get('/', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter();
    const models = await db.listAiModels();
    res.json(models);
  } catch (err) {
    next(err);
  }
});

// POST /api/models
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter();
    const body = req.body as Record<string, unknown>;
    const model = await db.createAiModel({
      id: uuidv4(),
      name: body['name'] ?? 'Unnamed Model',
      description: body['description'] ?? null,
      type: body['type'] ?? 'model',
      provider: body['provider'] ?? null,
      providerModel: body['providerModel'] ?? null,
      systemPrompt: body['systemPrompt'] ?? null,
      temperature: body['temperature'] ?? null,
      maxTokens: body['maxTokens'] ?? null,
      knowledgeStoreIds: body['knowledgeStoreIds'] ?? [],
      toolIds: body['toolIds'] ?? [],
      webhookId: body['webhookId'] ?? null,
      agentId: body['agentId'] ?? null,
      enabled: body['enabled'] !== false,
    });
    res.status(201).json(model);
  } catch (err) {
    next(err);
  }
});

// GET /api/models/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter();
    const model = await db.getAiModel(req.params.id as string);
    if (!model) return res.status(404).json({ error: 'Model not found' });
    res.json(model);
  } catch (err) {
    next(err);
  }
});

// PUT /api/models/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter();
    const model = await db.updateAiModel(req.params.id as string, req.body as Record<string, unknown>);
    if (!model) return res.status(404).json({ error: 'Model not found' });
    res.json(model);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/models/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter();
    await db.deleteAiModel(req.params.id as string);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
