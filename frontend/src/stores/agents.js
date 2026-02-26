import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const useAgentsStore = defineStore('agents', () => {
  const agents = ref([])

  async function loadAgents() {
    try {
      const { data } = await axios.get(`${API}/api/agents`)
      agents.value = data
    } catch (e) { console.error(e) }
  }

  async function createAgent(data) {
    const res = await axios.post(`${API}/api/agents`, data)
    agents.value.push(res.data)
    return res.data
  }

  async function updateAgent(id, data) {
    const res = await axios.put(`${API}/api/agents/${id}`, data)
    const idx = agents.value.findIndex(a => a.id === id)
    if (idx !== -1) agents.value[idx] = res.data
    return res.data
  }

  async function deleteAgent(id) {
    await axios.delete(`${API}/api/agents/${id}`)
    agents.value = agents.value.filter(a => a.id !== id)
  }

  return { agents, loadAgents, createAgent, updateAgent, deleteAgent }
})
