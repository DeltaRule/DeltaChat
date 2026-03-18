'use strict'

import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { getSharingService } from '../services/SharingService'

const router = Router()

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 100 * 1024 * 1024 },
})

// POST /api/knowledge-stores
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = { ...(req.body as Record<string, unknown>), ownerId: req.user!.id }
    const ks = await req.services.knowledgeService.createKnowledgeStore(body)
    res.status(201).json(ks)
  } catch (err) {
    next(err)
  }
})

// GET /api/knowledge-stores
router.get('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stores = await req.services.knowledgeService.listKnowledgeStores()
    const sharingService = getSharingService()
    const accessible = await sharingService.filterAccessible(
      req.user!.id,
      req.user!.role,
      'knowledge_store',
      stores,
    )
    // Enrich each store with its document count
    const enriched = await Promise.all(
      accessible.map(async (ks) => {
        try {
          const docs = await req.services.knowledgeService.listDocuments(ks.id)
          return {
            ...ks,
            documentCount: docs.length,
            _sharedWithMe: ks['ownerId'] !== req.user!.id,
          }
        } catch {
          return { ...ks, documentCount: 0, _sharedWithMe: ks['ownerId'] !== req.user!.id }
        }
      }),
    )
    res.json(enriched)
  } catch (err) {
    next(err)
  }
})

// GET /api/knowledge-stores/:id
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ks = await req.services.knowledgeService.getKnowledgeStore(req.params.id as string)
    res.json(ks)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/knowledge-stores/:id
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ks = await req.services.knowledgeService.getKnowledgeStore(req.params.id as string)
    if (!ks) return res.status(404).json({ error: 'Knowledge store not found' })
    if (ks['ownerId'] && ks['ownerId'] !== req.user!.id && req.user!.role !== 'admin') {
      return res
        .status(403)
        .json({ error: 'Only the owner or an admin can delete this knowledge store' })
    }
    await req.services.knowledgeService.deleteKnowledgeStore(req.params.id as string)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// POST /api/knowledge-stores/:id/documents (multipart upload)
router.post(
  '/:id/documents',
  upload.single('file'),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ks = await req.services.knowledgeService.getKnowledgeStore(req.params.id as string)
      if (!ks) return res.status(404).json({ error: 'Knowledge store not found' })
      if (ks['ownerId'] && ks['ownerId'] !== req.user!.id && req.user!.role !== 'admin') {
        return res.status(403).json({ error: 'Only the owner or an admin can upload documents' })
      }
      if (!req.file) {
        return res.status(400).json({ error: 'file field is required (multipart/form-data)' })
      }
      const doc = await req.services.knowledgeService.addDocument(req.params.id as string, req.file)
      res.status(202).json(doc)
    } catch (err) {
      next(err)
    }
  },
)

// GET /api/knowledge-stores/:id/documents
router.get('/:id/documents', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sharingService = getSharingService()
    if (req.user!.role !== 'admin') {
      const canAccess = await sharingService.canAccessResource(
        req.user!.id,
        'knowledge_store',
        req.params.id as string,
      )
      if (!canAccess) return res.status(403).json({ error: 'Access denied' })
    }
    const docs = await req.services.knowledgeService.listDocuments(req.params.id as string)
    res.json(docs)
  } catch (err) {
    next(err)
  }
})

// GET /api/knowledge-stores/:id/documents/:docId/download
router.get(
  '/:id/documents/:docId/download',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const sharingService = getSharingService()
      if (req.user!.role !== 'admin') {
        const canAccess = await sharingService.canAccessResource(
          req.user!.id,
          'knowledge_store',
          req.params.id as string,
        )
        if (!canAccess) return res.status(403).json({ error: 'Access denied' })
      }
      const doc = await req.services.knowledgeService.getDocument(
        req.params.id as string,
        req.params.docId as string,
      )
      const storage = req.services.knowledgeService.getBinaryStorage()
      const { buffer, metadata } = await storage.retrieve(req.params.docId as string)
      const filename = (doc['filename'] as string) || 'document'
      const mimeType =
        (metadata['mimeType'] as string) ||
        (doc['mimeType'] as string) ||
        'application/octet-stream'
      res.setHeader('Content-Type', mimeType)
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`)
      res.send(buffer)
    } catch (err) {
      next(err)
    }
  },
)

// DELETE /api/knowledge-stores/:id/documents/:docId
router.delete('/:id/documents/:docId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ks = await req.services.knowledgeService.getKnowledgeStore(req.params.id as string)
    if (!ks) return res.status(404).json({ error: 'Knowledge store not found' })
    if (ks['ownerId'] && ks['ownerId'] !== req.user!.id && req.user!.role !== 'admin') {
      return res.status(403).json({ error: 'Only the owner or an admin can delete documents' })
    }
    await req.services.knowledgeService.deleteDocument(
      req.params.id as string,
      req.params.docId as string,
    )
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
