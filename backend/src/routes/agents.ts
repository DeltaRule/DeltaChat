'use strict';

import { Router, Request, Response, NextFunction } from 'express';
import { randomUUID } from 'crypto';
import { getAdapter } from '../db/DeltaDatabaseAdapter';
import { getSharingService } from '../services/SharingService';

const router = Router();

// GET /api/agents
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter();
    const agents = await db.listAgents();
    const sharingService = getSharingService();
    const filtered = await sharingService.filterAccessible(req.user!.id, req.user!.role, 'agent', agents);
    res.json(filtered);
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
      id: randomUUID(),
      name: body['name'] ?? 'Unnamed Agent',
      description: body['description'] ?? null,
      systemPrompt: body['systemPrompt'] ?? '',
      provider: body['provider'] ?? null,
      providerModel: body['providerModel'] ?? null,
      knowledgeStoreIds: body['knowledgeStoreIds'] ?? [],
      toolIds: body['toolIds'] ?? [],
      temperature: body['temperature'] ?? null,
      maxTokens: body['maxTokens'] ?? null,
      ownerId: req.user!.id,
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
    const agent = await db.getAgent(req.params.id as string);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (agent['ownerId'] && agent['ownerId'] !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only the owner or an admin can edit this agent' });
    }
    const updated = await db.updateAgent(req.params.id as string, req.body as Record<string, unknown>);
    res.json(updated);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/agents/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter();
    const agent = await db.getAgent(req.params.id as string);
    if (!agent) return res.status(404).json({ error: 'Agent not found' });
    if (agent['ownerId'] && agent['ownerId'] !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only the owner or an admin can delete this agent' });
    }
    await db.deleteAgent(req.params.id as string);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
