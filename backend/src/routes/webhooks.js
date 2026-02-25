'use strict';

const { Router } = require('express');

const router = Router();

// POST /api/webhooks
router.post('/', async (req, res, next) => {
  try {
    const webhook = await req.services.webhookService.register(req.body);
    res.status(201).json(webhook);
  } catch (err) {
    next(err);
  }
});

// GET /api/webhooks
router.get('/', async (req, res, next) => {
  try {
    const webhooks = await req.services.webhookService.list();
    res.json(webhooks);
  } catch (err) {
    next(err);
  }
});

// GET /api/webhooks/:id
router.get('/:id', async (req, res, next) => {
  try {
    const webhook = await req.services.webhookService.get(req.params.id);
    res.json(webhook);
  } catch (err) {
    next(err);
  }
});

// PUT /api/webhooks/:id
router.put('/:id', async (req, res, next) => {
  try {
    const webhook = await req.services.webhookService.update(req.params.id, req.body);
    res.json(webhook);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/webhooks/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await req.services.webhookService.delete(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
