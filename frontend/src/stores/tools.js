import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const useToolsStore = defineStore('tools', () => {
  const tools = ref([])

  async function loadTools() {
    try {
      const { data } = await axios.get(`${API}/api/tools`)
      tools.value = data
    } catch (e) { console.error(e) }
  }

  async function createTool(data) {
    const res = await axios.post(`${API}/api/tools`, data)
    tools.value.push(res.data)
    return res.data
  }

  async function updateTool(id, data) {
    const res = await axios.put(`${API}/api/tools/${id}`, data)
    const idx = tools.value.findIndex(t => t.id === id)
    if (idx !== -1) tools.value[idx] = res.data
    return res.data
  }

  async function deleteTool(id) {
    await axios.delete(`${API}/api/tools/${id}`)
    tools.value = tools.value.filter(t => t.id !== id)
  }

  return { tools, loadTools, createTool, updateTool, deleteTool }
})
