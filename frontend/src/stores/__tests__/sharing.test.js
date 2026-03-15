import { describe, test, expect, beforeEach } from 'vitest'
import { mockApi, mockNotify, setupStoreTest } from './setup'
import { useSharingStore } from '../sharing'

describe('sharing store', () => {
  beforeEach(() => setupStoreTest())

  // ── loadShares ──────────────────────────────────────────────────────────

  describe('loadShares', () => {
    test('populates shares on success', async () => {
      mockApi.get.mockResolvedValue({ data: [{ id: 's1', targetType: 'user', targetId: 'u1' }] })
      const store = useSharingStore()
      await store.loadShares('ai_model', 'model-1')
      expect(store.shares).toHaveLength(1)
      expect(store.shares[0].id).toBe('s1')
    })

    test('shows notification on failure', async () => {
      mockApi.get.mockRejectedValue({ response: { data: { error: 'Forbidden' } } })
      const store = useSharingStore()
      await store.loadShares('ai_model', 'model-1')
      expect(mockNotify.error).toHaveBeenCalledWith('Forbidden')
    })
  })

  // ── shareResource ───────────────────────────────────────────────────────

  describe('shareResource', () => {
    test('calls POST /sharing with correct payload', async () => {
      mockApi.post.mockResolvedValue({ data: { id: 's2', resourceType: 'ai_model', resourceId: 'm1', targetType: 'user', targetId: 'u2' } })
      const store = useSharingStore()
      const result = await store.shareResource('ai_model', 'm1', 'user', 'u2')

      expect(mockApi.post).toHaveBeenCalledWith('/sharing', {
        resourceType: 'ai_model',
        resourceId: 'm1',
        targetType: 'user',
        targetId: 'u2',
      })
      expect(result.id).toBe('s2')
      expect(store.shares).toContainEqual(expect.objectContaining({ id: 's2' }))
    })

    test('shows notification on failure', async () => {
      mockApi.post.mockRejectedValue({ response: { data: { error: 'Admin required' } } })
      const store = useSharingStore()
      await expect(store.shareResource('ai_model', 'm1', 'user', 'u2')).rejects.toBeTruthy()
      expect(mockNotify.error).toHaveBeenCalledWith('Admin required')
    })
  })

  // ── unshare ─────────────────────────────────────────────────────────────

  describe('unshare', () => {
    test('removes share from local state', async () => {
      mockApi.get.mockResolvedValue({ data: [{ id: 's1' }, { id: 's2' }] })
      const store = useSharingStore()
      await store.loadShares('ai_model', 'model-1')
      expect(store.shares).toHaveLength(2)

      mockApi.delete.mockResolvedValue({})
      await store.unshare('s1')

      expect(store.shares).toHaveLength(1)
      expect(store.shares[0].id).toBe('s2')
    })

    test('shows notification on failure', async () => {
      mockApi.delete.mockRejectedValue({ response: { data: { error: 'Share not found' } } })
      const store = useSharingStore()
      await expect(store.unshare('nope')).rejects.toBeTruthy()
      expect(mockNotify.error).toHaveBeenCalledWith('Share not found')
    })
  })
})
