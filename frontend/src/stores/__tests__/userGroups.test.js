import { describe, test, expect, beforeEach } from 'vitest'
import { mockApi, mockNotify, setupStoreTest } from './setup'
import { useUserGroupsStore } from '../userGroups'

describe('userGroups store', () => {
  beforeEach(() => setupStoreTest())

  // ── addMembers ──────────────────────────────────────────────────────────

  describe('addMembers', () => {
    test('sends userIds (not memberIds) to the API', async () => {
      mockApi.get.mockResolvedValue({ data: [{ id: 'g1', memberIds: ['u1'] }] })
      const store = useUserGroupsStore()
      await store.loadGroups()

      mockApi.post.mockResolvedValue({ data: { id: 'g1', memberIds: ['u1', 'u2'] } })
      await store.addMembers('g1', ['u2'])

      expect(mockApi.post).toHaveBeenCalledWith('/user-groups/g1/members', { userIds: ['u2'] })
    })

    test('updates group in local store', async () => {
      mockApi.get.mockResolvedValue({ data: [{ id: 'g1', memberIds: [] }] })
      const store = useUserGroupsStore()
      await store.loadGroups()

      mockApi.post.mockResolvedValue({ data: { id: 'g1', memberIds: ['u1'] } })
      await store.addMembers('g1', ['u1'])

      expect(store.groups.find(g => g.id === 'g1').memberIds).toEqual(['u1'])
    })

    test('shows notification on failure', async () => {
      mockApi.post.mockRejectedValue({ response: { data: { error: 'userIds array required' } } })
      const store = useUserGroupsStore()
      await expect(store.addMembers('g1', ['u2'])).rejects.toBeTruthy()
      expect(mockNotify.error).toHaveBeenCalledWith('userIds array required')
    })
  })

  // ── removeMembers ───────────────────────────────────────────────────────

  describe('removeMembers', () => {
    test('sends userIds (not memberIds) in delete body', async () => {
      mockApi.get.mockResolvedValue({ data: [{ id: 'g1', memberIds: ['u1', 'u2'] }] })
      const store = useUserGroupsStore()
      await store.loadGroups()

      mockApi.delete.mockResolvedValue({ data: { id: 'g1', memberIds: ['u1'] } })
      await store.removeMembers('g1', ['u2'])

      expect(mockApi.delete).toHaveBeenCalledWith('/user-groups/g1/members', { data: { userIds: ['u2'] } })
    })

    test('shows notification on failure', async () => {
      mockApi.delete.mockRejectedValue({ response: { data: { error: 'Not found' } } })
      const store = useUserGroupsStore()
      await expect(store.removeMembers('g1', ['u1'])).rejects.toBeTruthy()
      expect(mockNotify.error).toHaveBeenCalledWith('Not found')
    })
  })

  // ── loadGroups ──────────────────────────────────────────────────────────

  describe('loadGroups', () => {
    test('populates groups on success', async () => {
      mockApi.get.mockResolvedValue({ data: [{ id: 'g1', name: 'Dev' }] })
      const store = useUserGroupsStore()
      await store.loadGroups()
      expect(store.groups).toEqual([{ id: 'g1', name: 'Dev' }])
    })

    test('shows notification on failure', async () => {
      mockApi.get.mockRejectedValue({ response: { data: { error: 'Auth fail' } } })
      const store = useUserGroupsStore()
      await store.loadGroups()
      expect(mockNotify.error).toHaveBeenCalledWith('Auth fail')
    })
  })
})
