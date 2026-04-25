import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../lib/api'
import { useNotificationStore } from './notification'
import type { Tool } from '../types'
import { getErrorMessage } from '../types'

export const useToolsStore = defineStore('tools', () => {
  const tools = ref<Tool[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadTools(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<Tool[]>('/tools')
      tools.value = data
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to load tools')
      useNotificationStore().error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function createTool(payload: Partial<Tool>): Promise<Tool> {
    try {
      const res = await api.post<Tool>('/tools', payload)
      tools.value.push(res.data)
      return res.data
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to create tool'))
      throw e
    }
  }

  async function updateTool(id: string, payload: Partial<Tool>): Promise<Tool> {
    try {
      const res = await api.put<Tool>(`/tools/${id}`, payload)
      const idx = tools.value.findIndex((t) => t.id === id)
      if (idx !== -1) tools.value[idx] = res.data
      return res.data
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to update tool'))
      throw e
    }
  }

  async function deleteTool(id: string): Promise<void> {
    try {
      await api.delete(`/tools/${id}`)
      tools.value = tools.value.filter((t) => t.id !== id)
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to delete tool'))
      throw e
    }
  }

  async function executeTool(id: string, args: Record<string, unknown>): Promise<unknown> {
    try {
      const { data } = await api.post<unknown>(`/tools/${id}/execute`, { args })
      return data
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to execute tool'))
      throw e
    }
  }

  return {
    tools,
    loading,
    error,
    loadTools,
    createTool,
    updateTool,
    deleteTool,
    executeTool,
  }
})
