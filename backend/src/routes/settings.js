'use strict';

const { Router } = require('express');
const { getAdapter } = require('../db/DeltaDatabaseAdapter');

const router = Router();

// GET /api/settings
router.get('/', async (req, res, next) => {
  try {
    const db = getAdapter();
    const settings = await db.getSettings();
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

// PUT /api/settings
router.put('/', async (req, res, next) => {
  try {
    const db = getAdapter();
    const settings = await db.updateSettings(req.body);
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
