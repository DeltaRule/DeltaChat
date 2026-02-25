'use strict';

import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
});

// POST /api/knowledge-stores
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ks = await req.services.knowledgeService.createKnowledgeStore(req.body as Record<string, unknown>);
    res.status(201).json(ks);
  } catch (err) {
    next(err);
  }
});

// GET /api/knowledge-stores
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stores = await req.services.knowledgeService.listKnowledgeStores();
    res.json(stores);
  } catch (err) {
    next(err);
  }
});

// GET /api/knowledge-stores/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ks = await req.services.knowledgeService.getKnowledgeStore(req.params.id as string);
    res.json(ks);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/knowledge-stores/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await req.services.knowledgeService.deleteKnowledgeStore(req.params.id as string);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/knowledge-stores/:id/documents (multipart upload)
router.post('/:id/documents', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'file field is required (multipart/form-data)' });
    }
    const doc = await req.services.knowledgeService.addDocument(req.params.id as string, req.file);
    res.status(202).json(doc);
  } catch (err) {
    next(err);
  }
});

// GET /api/knowledge-stores/:id/documents
router.get('/:id/documents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const docs = await req.services.knowledgeService.listDocuments(req.params.id as string);
    res.json(docs);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/knowledge-stores/:id/documents/:docId
router.delete('/:id/documents/:docId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    await req.services.knowledgeService.deleteDocument(req.params.id as string, req.params.docId as string);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
