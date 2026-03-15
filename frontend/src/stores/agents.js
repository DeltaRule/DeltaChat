import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../lib/api'
import { useNotificationStore } from './notification'

export const useAgentsStore = defineStore('agents', () => {
  const agents = ref([])

  async function loadAgents() {
    try {
      const { data } = await api.get('/agents')
      agents.value = data
    } catch (e) {
      useNotificationStore().error(e?.response?.data?.error || 'Failed to load agents')
    }
  }

  async function createAgent(data) {
    try {
      const res = await api.post('/agents', data)
      agents.value.push(res.data)
      return res.data
    } catch (e) {
      useNotificationStore().error(e?.response?.data?.error || 'Failed to create agent')
      throw e
    }
  }

  async function updateAgent(id, data) {
    try {
      const res = await api.put(`/agents/${id}`, data)
      const idx = agents.value.findIndex(a => a.id === id)
      if (idx !== -1) agents.value[idx] = res.data
      return res.data
    } catch (e) {
      useNotificationStore().error(e?.response?.data?.error || 'Failed to update agent')
      throw e
    }
  }

  async function deleteAgent(id) {
    try {
      await api.delete(`/agents/${id}`)
      agents.value = agents.value.filter(a => a.id !== id)
    } catch (e) {
      useNotificationStore().error(e?.response?.data?.error || 'Failed to delete agent')
      throw e
    }
  }

  return { agents, loadAgents, createAgent, updateAgent, deleteAgent }
})
