import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../lib/api'
import { useNotificationStore } from './notification'

export const useUsersStore = defineStore('users', () => {
  const users = ref([])
  const loading = ref(false)

  async function loadUsers() {
    loading.value = true
    try {
      const { data } = await api.get('/users')
      users.value = data
    } catch (e) {
      useNotificationStore().error(e?.response?.data?.error || 'Failed to load users')
    } finally {
      loading.value = false
    }
  }

  async function updateRole(userId, role) {
    try {
      const { data } = await api.patch(`/users/${userId}/role`, { role })
      const idx = users.value.findIndex(u => u.id === userId)
      if (idx !== -1) users.value[idx] = data
    } catch (e) {
      useNotificationStore().error(e?.response?.data?.error || 'Failed to update role')
      throw e
    }
  }

  async function toggleDisabled(userId, disabled) {
    try {
      const { data } = await api.patch(`/users/${userId}/disable`, { disabled })
      const idx = users.value.findIndex(u => u.id === userId)
      if (idx !== -1) users.value[idx] = data
    } catch (e) {
      useNotificationStore().error(e?.response?.data?.error || 'Failed to update user')
      throw e
    }
  }

  async function deleteUser(userId) {
    try {
      await api.delete(`/users/${userId}`)
      users.value = users.value.filter(u => u.id !== userId)
    } catch (e) {
      useNotificationStore().error(e?.response?.data?.error || 'Failed to delete user')
      throw e
    }
  }

  return { users, loading, loadUsers, updateRole, toggleDisabled, deleteUser }
})
