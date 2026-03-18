import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../lib/api'
import { useNotificationStore } from './notification'
import type { AiModel } from '../types'
import { getErrorMessage } from '../types'

export const useModelsStore = defineStore('models', () => {
  const aiModels = ref<AiModel[]>([])

  async function loadModels(): Promise<void> {
    try {
      const { data } = await api.get<AiModel[]>('/models')
      aiModels.value = data
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to load models'))
    }
  }

  async function createModel(payload: Partial<AiModel>): Promise<AiModel> {
    try {
      const res = await api.post<AiModel>('/models', payload)
      aiModels.value.push(res.data)
      return res.data
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to create model'))
      throw e
    }
  }

  async function updateModel(id: string, payload: Partial<AiModel>): Promise<AiModel> {
    try {
      const res = await api.put<AiModel>(`/models/${id}`, payload)
      const idx = aiModels.value.findIndex((m) => m.id === id)
      if (idx !== -1) aiModels.value[idx] = res.data
      return res.data
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to update model'))
      throw e
    }
  }

  async function deleteModel(id: string): Promise<void> {
    try {
      await api.delete(`/models/${id}`)
      aiModels.value = aiModels.value.filter((m) => m.id !== id)
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to delete model'))
      throw e
    }
  }

  return { aiModels, loadModels, createModel, updateModel, deleteModel }
})
