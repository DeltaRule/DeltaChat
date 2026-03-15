'use strict';

import { Router, Request, Response, NextFunction } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth';
import { getSharingService, ShareableResourceType } from '../services/SharingService';

const router = Router();

router.use(requireAuth, requireAdmin);

const VALID_RESOURCE_TYPES: ShareableResourceType[] = ['knowledge_store', 'ai_model', 'agent', 'tool'];

// GET /api/sharing/:resourceType/:resourceId — list shares for a resource
router.get('/:resourceType/:resourceId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const resourceType = req.params.resourceType as ShareableResourceType;
    if (!VALID_RESOURCE_TYPES.includes(resourceType)) {
      return res.status(400).json({ error: `Invalid resource type. Must be: ${VALID_RESOURCE_TYPES.join(', ')}` });
    }
    const sharingService = getSharingService();
    const shares = await sharingService.getSharesForResource(resourceType, req.params.resourceId as string);
    res.json(shares);
  } catch (err) {
    next(err);
  }
});

// POST /api/sharing — create a share
router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { resourceType, resourceId, targetType, targetId } = req.body as Record<string, string>;
    if (!VALID_RESOURCE_TYPES.includes(resourceType as ShareableResourceType)) {
      return res.status(400).json({ error: `Invalid resource type. Must be: ${VALID_RESOURCE_TYPES.join(', ')}` });
    }
    if (targetType !== 'user' && targetType !== 'group') {
      return res.status(400).json({ error: 'targetType must be "user" or "group"' });
    }
    if (!resourceId || !targetId) {
      return res.status(400).json({ error: 'resourceId and targetId are required' });
    }
    const sharingService = getSharingService();
    const share = await sharingService.shareResource(
      resourceType as ShareableResourceType,
      resourceId,
      targetType as 'user' | 'group',
      targetId,
      req.user!.id,
    );
    res.status(201).json(share);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/sharing/:shareId — remove a share
router.delete('/:shareId', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const sharingService = getSharingService();
    await sharingService.unshareResource(req.params.shareId as string);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

export default router;
