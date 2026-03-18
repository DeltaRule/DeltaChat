import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../lib/api'
import { useNotificationStore } from './notification'
import type { Agent } from '../types'
import { getErrorMessage } from '../types'

export const useAgentsStore = defineStore('agents', () => {
  const agents = ref<Agent[]>([])

  async function loadAgents(): Promise<void> {
    try {
      const { data } = await api.get<Agent[]>('/agents')
      agents.value = data
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to load agents'))
    }
  }

  async function createAgent(payload: Partial<Agent>): Promise<Agent> {
    try {
      const res = await api.post<Agent>('/agents', payload)
      agents.value.push(res.data)
      return res.data
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to create agent'))
      throw e
    }
  }

  async function updateAgent(id: string, payload: Partial<Agent>): Promise<Agent> {
    try {
      const res = await api.put<Agent>(`/agents/${id}`, payload)
      const idx = agents.value.findIndex((a) => a.id === id)
      if (idx !== -1) agents.value[idx] = res.data
      return res.data
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to update agent'))
      throw e
    }
  }

  async function deleteAgent(id: string): Promise<void> {
    try {
      await api.delete(`/agents/${id}`)
      agents.value = agents.value.filter((a) => a.id !== id)
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to delete agent'))
      throw e
    }
  }

  return { agents, loadAgents, createAgent, updateAgent, deleteAgent }
})
