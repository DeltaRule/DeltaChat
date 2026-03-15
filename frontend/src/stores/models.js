import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../lib/api'
import { useNotificationStore } from './notification'

export const useModelsStore = defineStore('models', () => {
  const aiModels = ref([])

  async function loadModels() {
    try {
      const { data } = await api.get('/models')
      aiModels.value = data
    } catch (e) {
      useNotificationStore().error(e?.response?.data?.error || 'Failed to load models')
    }
  }

  async function createModel(data) {
    try {
      const res = await api.post('/models', data)
      aiModels.value.push(res.data)
      return res.data
    } catch (e) {
      useNotificationStore().error(e?.response?.data?.error || 'Failed to create model')
      throw e
    }
  }

  async function updateModel(id, data) {
    try {
      const res = await api.put(`/models/${id}`, data)
      const idx = aiModels.value.findIndex(m => m.id === id)
      if (idx !== -1) aiModels.value[idx] = res.data
      return res.data
    } catch (e) {
      useNotificationStore().error(e?.response?.data?.error || 'Failed to update model')
      throw e
    }
  }

  async function deleteModel(id) {
    try {
      await api.delete(`/models/${id}`)
      aiModels.value = aiModels.value.filter(m => m.id !== id)
    } catch (e) {
      useNotificationStore().error(e?.response?.data?.error || 'Failed to delete model')
      throw e
    }
  }

  return { aiModels, loadModels, createModel, updateModel, deleteModel }
})
