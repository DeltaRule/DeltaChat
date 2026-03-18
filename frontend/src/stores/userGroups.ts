import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../lib/api'
import { useNotificationStore } from './notification'
import type { UserGroup } from '../types'
import { getErrorMessage } from '../types'

export const useUserGroupsStore = defineStore('userGroups', () => {
  const groups = ref<UserGroup[]>([])
  const loading = ref(false)

  async function loadGroups(): Promise<void> {
    loading.value = true
    try {
      const { data } = await api.get<UserGroup[]>('/user-groups')
      groups.value = data
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to load groups'))
    } finally {
      loading.value = false
    }
  }

  async function createGroup(name: string, description = ''): Promise<UserGroup> {
    try {
      const { data } = await api.post<UserGroup>('/user-groups', { name, description })
      groups.value.push(data)
      return data
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to create group'))
      throw e
    }
  }

  async function updateGroup(groupId: string, updates: Partial<UserGroup>): Promise<UserGroup> {
    try {
      const { data } = await api.put<UserGroup>(`/user-groups/${groupId}`, updates)
      const idx = groups.value.findIndex((g) => g.id === groupId)
      if (idx !== -1) groups.value[idx] = data
      return data
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to update group'))
      throw e
    }
  }

  async function deleteGroup(groupId: string): Promise<void> {
    try {
      await api.delete(`/user-groups/${groupId}`)
      groups.value = groups.value.filter((g) => g.id !== groupId)
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to delete group'))
      throw e
    }
  }

  async function addMembers(groupId: string, memberIds: string[]): Promise<UserGroup> {
    try {
      const { data } = await api.post<UserGroup>(`/user-groups/${groupId}/members`, {
        userIds: memberIds,
      })
      const idx = groups.value.findIndex((g) => g.id === groupId)
      if (idx !== -1) groups.value[idx] = data
      return data
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to add members'))
      throw e
    }
  }

  async function removeMembers(groupId: string, memberIds: string[]): Promise<UserGroup> {
    try {
      const { data } = await api.delete<UserGroup>(`/user-groups/${groupId}/members`, {
        data: { userIds: memberIds },
      })
      const idx = groups.value.findIndex((g) => g.id === groupId)
      if (idx !== -1) groups.value[idx] = data
      return data
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to remove members'))
      throw e
    }
  }

  return {
    groups,
    loading,
    loadGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    addMembers,
    removeMembers,
  }
})
