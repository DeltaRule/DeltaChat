'use strict';

const { Router } = require('express');
const multer = require('multer');

const router = Router();

// Store uploads in memory so the service can access the buffer directly
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100 MB
});

// POST /api/knowledge-stores
router.post('/', async (req, res, next) => {
  try {
    const ks = await req.services.knowledgeService.createKnowledgeStore(req.body);
    res.status(201).json(ks);
  } catch (err) {
    next(err);
  }
});

// GET /api/knowledge-stores
router.get('/', async (req, res, next) => {
  try {
    const stores = await req.services.knowledgeService.listKnowledgeStores();
    res.json(stores);
  } catch (err) {
    next(err);
  }
});

// GET /api/knowledge-stores/:id
router.get('/:id', async (req, res, next) => {
  try {
    const ks = await req.services.knowledgeService.getKnowledgeStore(req.params.id);
    res.json(ks);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/knowledge-stores/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await req.services.knowledgeService.deleteKnowledgeStore(req.params.id);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/knowledge-stores/:id/documents  (multipart upload)
router.post('/:id/documents', upload.single('file'), async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'file field is required (multipart/form-data)' });
    }
    const doc = await req.services.knowledgeService.addDocument(req.params.id, req.file);
    res.status(202).json(doc); // 202 because indexing happens asynchronously
  } catch (err) {
    next(err);
  }
});

// GET /api/knowledge-stores/:id/documents
router.get('/:id/documents', async (req, res, next) => {
  try {
    const docs = await req.services.knowledgeService.listDocuments(req.params.id);
    res.json(docs);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/knowledge-stores/:id/documents/:docId
router.delete('/:id/documents/:docId', async (req, res, next) => {
  try {
    await req.services.knowledgeService.deleteDocument(req.params.id, req.params.docId);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
