'use strict'

import { SharingService, ShareableResourceType } from '../SharingService'
import type { Entity } from '../../db/DeltaDatabaseAdapter'

// ── Mock the DeltaDatabaseAdapter ────────────────────────────────────────

const mockAdapter = {
  listAiModels: jest.fn(),
  listAgents: jest.fn(),
  listTools: jest.fn(),
  listKnowledgeStores: jest.fn(),
  getResourceSharesForTarget: jest.fn(),
  getResourceSharesForResource: jest.fn(),
  getUserGroupsForUser: jest.fn(),
  createResourceShare: jest.fn(),
  deleteResourceShare: jest.fn(),
}

jest.mock('../../db/DeltaDatabaseAdapter', () => ({
  getAdapter: () => mockAdapter,
}))

describe('SharingService', () => {
  let service: SharingService

  const adminUser = { id: 'admin-1', role: 'admin' }
  const regularUser = { id: 'user-1', role: 'user' }
  const otherUser = { id: 'user-2', role: 'user' }

  const ownedModel: Entity = { id: 'model-1', name: 'My Model', ownerId: 'user-1' }
  const otherModel: Entity = { id: 'model-2', name: 'Other Model', ownerId: 'user-2' }
  const legacyModel: Entity = { id: 'model-3', name: 'Legacy Model' } // no ownerId
  const sharedModel: Entity = { id: 'model-4', name: 'Shared Model', ownerId: 'user-2' }

  beforeEach(() => {
    jest.clearAllMocks()
    service = new SharingService()

    mockAdapter.listAiModels.mockResolvedValue([ownedModel, otherModel, legacyModel, sharedModel])
    mockAdapter.listAgents.mockResolvedValue([])
    mockAdapter.listTools.mockResolvedValue([])
    mockAdapter.listKnowledgeStores.mockResolvedValue([])
    mockAdapter.getResourceSharesForTarget.mockResolvedValue([])
    mockAdapter.getUserGroupsForUser.mockResolvedValue([])
    mockAdapter.getResourceSharesForResource.mockResolvedValue([])
  })

  // ── filterAccessible ─────────────────────────────────────────────────────

  describe('filterAccessible', () => {
    const allModels = [ownedModel, otherModel, legacyModel, sharedModel]

    test('admin sees all resources', async () => {
      const result = await service.filterAccessible(
        adminUser.id,
        adminUser.role,
        'ai_model',
        allModels,
      )
      expect(result).toEqual(allModels)
    })

    test('regular user sees only owned resources (not legacy, not others)', async () => {
      const result = await service.filterAccessible(
        regularUser.id,
        regularUser.role,
        'ai_model',
        allModels,
      )
      expect(result.map((r) => r.id)).toContain('model-1')
      expect(result.map((r) => r.id)).not.toContain('model-2')
      expect(result.map((r) => r.id)).not.toContain('model-3') // legacy — no owner
      expect(result.map((r) => r.id)).not.toContain('model-4')
    })

    test('regular user sees directly shared resources', async () => {
      mockAdapter.getResourceSharesForTarget.mockResolvedValue([
        {
          id: 'share-1',
          resourceType: 'ai_model',
          resourceId: 'model-4',
          targetType: 'user',
          targetId: 'user-1',
        },
      ])

      const result = await service.filterAccessible(
        regularUser.id,
        regularUser.role,
        'ai_model',
        allModels,
      )
      expect(result.map((r) => r.id)).toContain('model-1') // owned
      expect(result.map((r) => r.id)).toContain('model-4') // shared
      expect(result.map((r) => r.id)).not.toContain('model-2')
      expect(result.map((r) => r.id)).not.toContain('model-3')
    })

    test('regular user sees group-shared resources', async () => {
      mockAdapter.getUserGroupsForUser.mockResolvedValue([
        { id: 'group-1', name: 'Team', memberIds: ['user-1'] },
      ])
      mockAdapter.getResourceSharesForTarget
        .mockResolvedValueOnce([]) // user shares
        .mockResolvedValueOnce([
          // group shares
          {
            id: 'share-2',
            resourceType: 'ai_model',
            resourceId: 'model-2',
            targetType: 'group',
            targetId: 'group-1',
          },
        ])

      const result = await service.filterAccessible(
        regularUser.id,
        regularUser.role,
        'ai_model',
        allModels,
      )
      expect(result.map((r) => r.id)).toContain('model-1') // owned
      expect(result.map((r) => r.id)).toContain('model-2') // group-shared
    })

    test('legacy resources without ownerId are NOT visible to regular users', async () => {
      const result = await service.filterAccessible(regularUser.id, regularUser.role, 'ai_model', [
        legacyModel,
      ])
      expect(result).toHaveLength(0)
    })
  })

  // ── getAccessibleResourceIds ─────────────────────────────────────────────

  describe('getAccessibleResourceIds', () => {
    test('returns only owned resource IDs for regular user', async () => {
      const ids = await service.getAccessibleResourceIds(regularUser.id, 'ai_model')
      expect(ids.has('model-1')).toBe(true)
      expect(ids.has('model-2')).toBe(false)
      expect(ids.has('model-3')).toBe(false)
    })

    test('includes directly shared resource IDs', async () => {
      mockAdapter.getResourceSharesForTarget.mockResolvedValue([
        {
          id: 's1',
          resourceType: 'ai_model',
          resourceId: 'model-4',
          targetType: 'user',
          targetId: 'user-1',
        },
      ])

      const ids = await service.getAccessibleResourceIds(regularUser.id, 'ai_model')
      expect(ids.has('model-1')).toBe(true)
      expect(ids.has('model-4')).toBe(true)
    })

    test('includes group-shared resource IDs', async () => {
      mockAdapter.getUserGroupsForUser.mockResolvedValue([
        { id: 'g1', name: 'G', memberIds: ['user-1'] },
      ])
      mockAdapter.getResourceSharesForTarget
        .mockResolvedValueOnce([]) // user shares
        .mockResolvedValueOnce([
          // group shares for g1
          {
            id: 's2',
            resourceType: 'ai_model',
            resourceId: 'model-2',
            targetType: 'group',
            targetId: 'g1',
          },
        ])

      const ids = await service.getAccessibleResourceIds(regularUser.id, 'ai_model')
      expect(ids.has('model-2')).toBe(true)
    })

    test('does not include unrelated resource type shares', async () => {
      mockAdapter.getResourceSharesForTarget.mockResolvedValue([
        {
          id: 's3',
          resourceType: 'agent',
          resourceId: 'agent-99',
          targetType: 'user',
          targetId: 'user-1',
        },
      ])

      const ids = await service.getAccessibleResourceIds(regularUser.id, 'ai_model')
      expect(ids.has('agent-99')).toBe(false)
    })
  })

  // ── canAccessResource ────────────────────────────────────────────────────

  describe('canAccessResource', () => {
    test('returns true for owned resource', async () => {
      const result = await service.canAccessResource(regularUser.id, 'ai_model', 'model-1')
      expect(result).toBe(true)
    })

    test('returns false for unshared resource', async () => {
      const result = await service.canAccessResource(regularUser.id, 'ai_model', 'model-2')
      expect(result).toBe(false)
    })

    test('returns false for legacy resource without owner', async () => {
      const result = await service.canAccessResource(regularUser.id, 'ai_model', 'model-3')
      expect(result).toBe(false)
    })
  })

  // ── shareResource ────────────────────────────────────────────────────────

  describe('shareResource', () => {
    test('creates a share', async () => {
      const expected = {
        id: 'new-share',
        resourceType: 'ai_model',
        resourceId: 'model-1',
        targetType: 'user',
        targetId: 'user-2',
        sharedById: 'admin-1',
      }
      mockAdapter.createResourceShare.mockResolvedValue(expected)

      const result = await service.shareResource('ai_model', 'model-1', 'user', 'user-2', 'admin-1')
      expect(mockAdapter.createResourceShare).toHaveBeenCalledWith(
        expect.objectContaining({
          resourceType: 'ai_model',
          resourceId: 'model-1',
          targetType: 'user',
          targetId: 'user-2',
        }),
      )
      expect(result).toEqual(expected)
    })

    test('returns existing share if duplicate', async () => {
      const existing = {
        id: 'dup-share',
        resourceType: 'ai_model',
        resourceId: 'model-1',
        targetType: 'user',
        targetId: 'user-2',
      }
      mockAdapter.getResourceSharesForResource.mockResolvedValue([existing])

      const result = await service.shareResource('ai_model', 'model-1', 'user', 'user-2', 'admin-1')
      expect(mockAdapter.createResourceShare).not.toHaveBeenCalled()
      expect(result).toEqual(existing)
    })
  })

  // ── unshareResource ──────────────────────────────────────────────────────

  describe('unshareResource', () => {
    test('delegates to adapter', async () => {
      mockAdapter.deleteResourceShare.mockResolvedValue({ ok: true })
      await service.unshareResource('share-42')
      expect(mockAdapter.deleteResourceShare).toHaveBeenCalledWith('share-42')
    })
  })
})
