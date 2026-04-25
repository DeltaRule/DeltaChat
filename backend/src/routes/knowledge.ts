'use strict'

import { Router, Request, Response, NextFunction } from 'express'
import multer from 'multer'
import { getSharingService } from '../services/SharingService'

const router = Router()

const ALLOWED_MIME_TYPES = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/markdown',
  'text/csv',
  'text/html',
  'application/json',
  'application/xml',
  'text/xml',
])

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
  fileFilter(_req, file, cb) {
    if (ALLOWED_MIME_TYPES.has(file.mimetype)) {
      cb(null, true)
    } else {
      cb(
        new Error(
          `File type "${file.mimetype}" is not permitted. Allowed types: PDF, Word, Excel, plain text, markdown, CSV, HTML, JSON, XML.`,
        ),
      )
    }
  },
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
    if (!ks) return res.status(404).json({ error: 'Knowledge store not found' })
    const sharingService = getSharingService()
    if (req.user!.role !== 'admin') {
      const canAccess = await sharingService.canAccessResource(
        req.user!.id,
        'knowledge_store',
        req.params.id as string,
      )
      if (!canAccess) return res.status(403).json({ error: 'Access denied' })
    }
    res.json(ks)
  } catch (err) {
    next(err)
  }
})

// PUT /api/knowledge/:id — update store name, description, or pipeline config
router.put('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ks = await req.services.knowledgeService.getKnowledgeStore(req.params.id as string)
    if (!ks) return res.status(404).json({ error: 'Knowledge store not found' })
    if (ks['ownerId'] && ks['ownerId'] !== req.user!.id && req.user!.role !== 'admin') {
      return res
        .status(403)
        .json({ error: 'Only the owner or an admin can update this knowledge store' })
    }
    // Strip ownerId from caller-supplied body — ownership cannot be transferred via PUT
    const body = req.body as Record<string, unknown>
    const { ownerId: _drop, ...allowed } = body
    const updated = await req.services.knowledgeService.updateKnowledgeStore(
      req.params.id as string,
      allowed,
    )
    res.json(updated)
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
      const rawFilename = (doc['filename'] as string) || 'document'
      const safeFilename = rawFilename.replace(/["\r\n\\]/g, '_')
      const mimeType =
        (metadata['mimeType'] as string) ||
        (doc['mimeType'] as string) ||
        'application/octet-stream'
      res.setHeader('Content-Type', mimeType)
      res.setHeader('Content-Disposition', `attachment; filename="${safeFilename}"`)
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
