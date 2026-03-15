import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../lib/api'
import { useNotificationStore } from './notification'

export const useSharingStore = defineStore('sharing', () => {
  const shares = ref([])
  const loading = ref(false)

  async function loadShares(resourceType, resourceId) {
    loading.value = true
    try {
      const { data } = await api.get(`/sharing/${resourceType}/${resourceId}`)
      shares.value = data
    } catch (e) {
      useNotificationStore().error(e?.response?.data?.error || 'Failed to load shares')
    } finally {
      loading.value = false
    }
  }

  async function shareResource(resourceType, resourceId, targetType, targetId) {
    try {
      const { data } = await api.post('/sharing', { resourceType, resourceId, targetType, targetId })
      shares.value.push(data)
      return data
    } catch (e) {
      useNotificationStore().error(e?.response?.data?.error || 'Failed to share resource')
      throw e
    }
  }

  async function unshare(shareId) {
    try {
      await api.delete(`/sharing/${shareId}`)
      shares.value = shares.value.filter(s => s.id !== shareId)
    } catch (e) {
      useNotificationStore().error(e?.response?.data?.error || 'Failed to remove share')
      throw e
    }
  }

  return { shares, loading, loadShares, shareResource, unshare }
})
