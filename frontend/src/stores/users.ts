import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../lib/api'
import { useNotificationStore } from './notification'
import type { User } from '../types'
import { getErrorMessage } from '../types'

export const useUsersStore = defineStore('users', () => {
  const users = ref<User[]>([])
  const loading = ref(false)

  async function loadUsers(): Promise<void> {
    loading.value = true
    try {
      const { data } = await api.get<User[]>('/users')
      users.value = data
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to load users'))
    } finally {
      loading.value = false
    }
  }

  async function updateRole(userId: string, role: string): Promise<void> {
    try {
      const { data } = await api.patch<User>(`/users/${userId}/role`, { role })
      const idx = users.value.findIndex((u) => u.id === userId)
      if (idx !== -1) users.value[idx] = data
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to update role'))
      throw e
    }
  }

  async function toggleDisabled(userId: string, disabled: boolean): Promise<void> {
    try {
      const { data } = await api.patch<User>(`/users/${userId}/disable`, { disabled })
      const idx = users.value.findIndex((u) => u.id === userId)
      if (idx !== -1) users.value[idx] = data
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to update user'))
      throw e
    }
  }

  async function deleteUser(userId: string): Promise<void> {
    try {
      await api.delete(`/users/${userId}`)
      users.value = users.value.filter((u) => u.id !== userId)
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to delete user'))
      throw e
    }
  }

  return { users, loading, loadUsers, updateRole, toggleDisabled, deleteUser }
})
