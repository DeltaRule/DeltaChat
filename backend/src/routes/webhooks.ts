'use strict';

import { Router, Request, Response, NextFunction } from 'express';

const router = Router();

// POST /api/webhooks
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const webhook = await req.services.webhookService.register(req.body as Record<string, unknown>);
    res.status(201).json(webhook);
  } catch (err) {
    next(err);
  }
});

// GET /api/webhooks
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const webhooks = await req.services.webhookService.list();
    res.json(webhooks);
  } catch (err) {
    next(err);
  }
});

// GET /api/webhooks/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const webhook = await req.services.webhookService.get(req.params.id as string);
    res.json(webhook);
  } catch (err) {
    next(err);
  }
});

// PUT /api/webhooks/:id
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const webhook = await req.services.webhookService.update(req.params.id as string, req.body as Record<string, unknown>);
    res.json(webhook);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/webhooks/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await req.services.webhookService.delete(req.params.id as string);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
