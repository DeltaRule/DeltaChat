import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../lib/api'
import { useNotificationStore } from './notification'
import type { Share } from '../types'
import { getErrorMessage } from '../types'

export const useSharingStore = defineStore('sharing', () => {
  const shares = ref<Share[]>([])
  const loading = ref(false)

  async function loadShares(resourceType: string, resourceId: string): Promise<void> {
    loading.value = true
    try {
      const { data } = await api.get<Share[]>(`/sharing/${resourceType}/${resourceId}`)
      shares.value = data
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to load shares'))
    } finally {
      loading.value = false
    }
  }

  async function shareResource(
    resourceType: string,
    resourceId: string,
    targetType: string,
    targetId: string,
  ): Promise<Share> {
    try {
      const { data } = await api.post<Share>('/sharing', {
        resourceType,
        resourceId,
        targetType,
        targetId,
      })
      shares.value.push(data)
      return data
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to share resource'))
      throw e
    }
  }

  async function unshare(shareId: string): Promise<void> {
    try {
      await api.delete(`/sharing/${shareId}`)
      shares.value = shares.value.filter((s) => s.id !== shareId)
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to remove share'))
      throw e
    }
  }

  return { shares, loading, loadShares, shareResource, unshare }
})
