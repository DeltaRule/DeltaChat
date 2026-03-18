'use strict'

import { randomUUID } from 'crypto'
import { getAdapter, Entity } from '../db/DeltaDatabaseAdapter'

export type ShareableResourceType = 'knowledge_store' | 'ai_model' | 'agent' | 'tool'

export class SharingService {
  /** Share a resource with a user or group. Admin only. */
  async shareResource(
    resourceType: ShareableResourceType,
    resourceId: string,
    targetType: 'user' | 'group',
    targetId: string,
    sharedById: string,
  ): Promise<Entity> {
    const db = getAdapter()

    // Check for duplicate share
    const existing = await db.getResourceSharesForResource(resourceType, resourceId)
    const dup = existing.find((s) => s['targetType'] === targetType && s['targetId'] === targetId)
    if (dup) return dup

    return db.createResourceShare({
      id: randomUUID(),
      resourceType,
      resourceId,
      targetType,
      targetId,
      sharedById,
    })
  }

  /** Remove a share by its ID. */
  async unshareResource(shareId: string): Promise<void> {
    const db = getAdapter()
    await db.deleteResourceShare(shareId)
  }

  /** List all shares for a specific resource. */
  async getSharesForResource(
    resourceType: ShareableResourceType,
    resourceId: string,
  ): Promise<Entity[]> {
    const db = getAdapter()
    return db.getResourceSharesForResource(resourceType, resourceId)
  }

  /**
   * Get all resource IDs of a given type that a user can access:
   * - Resources they own
   * - Resources shared directly with them
   * - Resources shared with groups they belong to
   * Note: Resources without an ownerId (legacy) are NOT accessible to regular users.
   */
  async getAccessibleResourceIds(
    userId: string,
    resourceType: ShareableResourceType,
  ): Promise<Set<string>> {
    const db = getAdapter()
    const ids = new Set<string>()

    // 1. Get all resources and find owned ones only
    const collectionMap: Record<ShareableResourceType, () => Promise<Entity[]>> = {
      knowledge_store: () => db.listKnowledgeStores(),
      ai_model: () => db.listAiModels(),
      agent: () => db.listAgents(),
      tool: () => db.listTools(),
    }
    const allResources = await collectionMap[resourceType]()
    for (const r of allResources) {
      if (r['ownerId'] === userId) {
        ids.add(r.id)
      }
    }

    // 2. Direct shares to user
    const userShares = await db.getResourceSharesForTarget('user', userId)
    for (const s of userShares) {
      if (s['resourceType'] === resourceType) ids.add(s['resourceId'] as string)
    }

    // 3. Group shares
    const groups = await db.getUserGroupsForUser(userId)
    for (const g of groups) {
      const groupShares = await db.getResourceSharesForTarget('group', g.id)
      for (const s of groupShares) {
        if (s['resourceType'] === resourceType) ids.add(s['resourceId'] as string)
      }
    }

    return ids
  }

  /** Check if a user can access a specific resource. */
  async canAccessResource(
    userId: string,
    resourceType: ShareableResourceType,
    resourceId: string,
  ): Promise<boolean> {
    const accessible = await this.getAccessibleResourceIds(userId, resourceType)
    return accessible.has(resourceId)
  }

  /** Filter a list of entities to only those accessible to the user. */
  async filterAccessible(
    userId: string,
    userRole: string,
    resourceType: ShareableResourceType,
    entities: Entity[],
  ): Promise<Entity[]> {
    // Admins can see everything
    if (userRole === 'admin') return entities

    const accessible = await this.getAccessibleResourceIds(userId, resourceType)
    return entities.filter((e) => accessible.has(e.id))
  }
}

let _instance: SharingService | null = null
export function getSharingService(): SharingService {
  if (!_instance) _instance = new SharingService()
  return _instance
}
