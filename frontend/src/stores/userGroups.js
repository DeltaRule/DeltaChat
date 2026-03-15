import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../lib/api'
import { useNotificationStore } from './notification'

export const useUserGroupsStore = defineStore('userGroups', () => {
  const groups = ref([])
  const loading = ref(false)

  async function loadGroups() {
    loading.value = true
    try {
      const { data } = await api.get('/user-groups')
      groups.value = data
    } catch (e) {
      useNotificationStore().error(e?.response?.data?.error || 'Failed to load groups')
    } finally {
      loading.value = false
    }
  }

  async function createGroup(name, description = '') {
    try {
      const { data } = await api.post('/user-groups', { name, description })
      groups.value.push(data)
      return data
    } catch (e) {
      useNotificationStore().error(e?.response?.data?.error || 'Failed to create group')
      throw e
    }
  }

  async function updateGroup(groupId, updates) {
    try {
      const { data } = await api.put(`/user-groups/${groupId}`, updates)
      const idx = groups.value.findIndex(g => g.id === groupId)
      if (idx !== -1) groups.value[idx] = data
      return data
    } catch (e) {
      useNotificationStore().error(e?.response?.data?.error || 'Failed to update group')
      throw e
    }
  }

  async function deleteGroup(groupId) {
    try {
      await api.delete(`/user-groups/${groupId}`)
      groups.value = groups.value.filter(g => g.id !== groupId)
    } catch (e) {
      useNotificationStore().error(e?.response?.data?.error || 'Failed to delete group')
      throw e
    }
  }

  async function addMembers(groupId, memberIds) {
    try {
      const { data } = await api.post(`/user-groups/${groupId}/members`, { userIds: memberIds })
      const idx = groups.value.findIndex(g => g.id === groupId)
      if (idx !== -1) groups.value[idx] = data
      return data
    } catch (e) {
      useNotificationStore().error(e?.response?.data?.error || 'Failed to add members')
      throw e
    }
  }

  async function removeMembers(groupId, memberIds) {
    try {
      const { data } = await api.delete(`/user-groups/${groupId}/members`, { data: { userIds: memberIds } })
      const idx = groups.value.findIndex(g => g.id === groupId)
      if (idx !== -1) groups.value[idx] = data
      return data
    } catch (e) {
      useNotificationStore().error(e?.response?.data?.error || 'Failed to remove members')
      throw e
    }
  }

  return { groups, loading, loadGroups, createGroup, updateGroup, deleteGroup, addMembers, removeMembers }
})
