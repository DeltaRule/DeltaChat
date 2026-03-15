import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../lib/api'
import { useNotificationStore } from './notification'

export const useToolsStore = defineStore('tools', () => {
  const tools = ref([])

  async function loadTools() {
    try {
      const { data } = await api.get('/tools')
      tools.value = data
    } catch (e) {
      useNotificationStore().error(e?.response?.data?.error || 'Failed to load tools')
    }
  }

  async function createTool(data) {
    try {
      const res = await api.post('/tools', data)
      tools.value.push(res.data)
      return res.data
    } catch (e) {
      useNotificationStore().error(e?.response?.data?.error || 'Failed to create tool')
      throw e
    }
  }

  async function updateTool(id, data) {
    try {
      const res = await api.put(`/tools/${id}`, data)
      const idx = tools.value.findIndex(t => t.id === id)
      if (idx !== -1) tools.value[idx] = res.data
      return res.data
    } catch (e) {
      useNotificationStore().error(e?.response?.data?.error || 'Failed to update tool')
      throw e
    }
  }

  async function deleteTool(id) {
    try {
      await api.delete(`/tools/${id}`)
      tools.value = tools.value.filter(t => t.id !== id)
    } catch (e) {
      useNotificationStore().error(e?.response?.data?.error || 'Failed to delete tool')
      throw e
    }
  }

  return { tools, loadTools, createTool, updateTool, deleteTool }
})
