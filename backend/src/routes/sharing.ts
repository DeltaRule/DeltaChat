'use strict'

import { Router, Request, Response, NextFunction } from 'express'
import { requireAuth } from '../middleware/auth'
import { getSharingService, ShareableResourceType } from '../services/SharingService'
import { getAdapter } from '../db/DeltaDatabaseAdapter'

const router = Router()

router.use(requireAuth)

const VALID_RESOURCE_TYPES: ShareableResourceType[] = [
  'knowledge_store',
  'ai_model',
  'agent',
  'tool',
]

/** Look up the ownerId for a resource by type and id. */
async function getResourceOwnerId(
  resourceType: ShareableResourceType,
  resourceId: string,
): Promise<string | null> {
  const db = getAdapter()
  const lookups: Record<ShareableResourceType, () => Promise<Record<string, unknown> | null>> = {
    knowledge_store: () => db.getKnowledgeStore(resourceId),
    ai_model: () => db.getAiModel(resourceId),
    agent: () => db.getAgent(resourceId),
    tool: () => db.getTool(resourceId),
  }
  const resource = await lookups[resourceType]()
  return (resource?.['ownerId'] as string) || null
}

function isOwnerOrAdmin(ownerId: string | null, req: Request): boolean {
  return req.user!.role === 'admin' || ownerId === req.user!.id
}

// GET /api/sharing/:resourceType/:resourceId — list shares for a resource
router.get(
  '/:resourceType/:resourceId',
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const resourceType = req.params.resourceType as ShareableResourceType
      if (!VALID_RESOURCE_TYPES.includes(resourceType)) {
        return res
          .status(400)
          .json({ error: `Invalid resource type. Must be: ${VALID_RESOURCE_TYPES.join(', ')}` })
      }
      const ownerId = await getResourceOwnerId(resourceType, req.params.resourceId as string)
      if (!isOwnerOrAdmin(ownerId, req)) {
        return res
          .status(403)
          .json({ error: 'Only the resource owner or an admin can view shares' })
      }
      const sharingService = getSharingService()
      const shares = await sharingService.getSharesForResource(
        resourceType,
        req.params.resourceId as string,
      )
      res.json(shares)
    } catch (err) {
      next(err)
    }
  },
)

// POST /api/sharing — create a share
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { resourceType, resourceId, targetType, targetId } = req.body as Record<string, string>
    if (!VALID_RESOURCE_TYPES.includes(resourceType as ShareableResourceType)) {
      return res
        .status(400)
        .json({ error: `Invalid resource type. Must be: ${VALID_RESOURCE_TYPES.join(', ')}` })
    }
    if (targetType !== 'user' && targetType !== 'group') {
      return res.status(400).json({ error: 'targetType must be "user" or "group"' })
    }
    if (!resourceId || !targetId) {
      return res.status(400).json({ error: 'resourceId and targetId are required' })
    }
    const ownerId = await getResourceOwnerId(resourceType as ShareableResourceType, resourceId)
    if (!isOwnerOrAdmin(ownerId, req)) {
      return res
        .status(403)
        .json({ error: 'Only the resource owner or an admin can share this resource' })
    }
    const sharingService = getSharingService()
    const share = await sharingService.shareResource(
      resourceType as ShareableResourceType,
      resourceId,
      targetType as 'user' | 'group',
      targetId,
      req.user!.id,
    )
    res.status(201).json(share)
  } catch (err) {
    next(err)
  }
})

// DELETE /api/sharing/:shareId — remove a share
router.delete('/:shareId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sharingService = getSharingService()
    const db = getAdapter()
    const share = await db.getResourceShare(req.params.shareId as string)
    if (!share) return res.status(404).json({ error: 'Share not found' })
    const ownerId = await getResourceOwnerId(
      share['resourceType'] as ShareableResourceType,
      share['resourceId'] as string,
    )
    if (!isOwnerOrAdmin(ownerId, req)) {
      return res
        .status(403)
        .json({ error: 'Only the resource owner or an admin can remove shares' })
    }
    await sharingService.unshareResource(req.params.shareId as string)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

export default router
