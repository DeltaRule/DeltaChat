import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const useModelsStore = defineStore('models', () => {
  const aiModels = ref([])

  async function loadModels() {
    try {
      const { data } = await axios.get(`${API}/api/models`)
      aiModels.value = data
    } catch (e) { console.error(e) }
  }

  async function createModel(data) {
    const res = await axios.post(`${API}/api/models`, data)
    aiModels.value.push(res.data)
    return res.data
  }

  async function updateModel(id, data) {
    const res = await axios.put(`${API}/api/models/${id}`, data)
    const idx = aiModels.value.findIndex(m => m.id === id)
    if (idx !== -1) aiModels.value[idx] = res.data
    return res.data
  }

  async function deleteModel(id) {
    await axios.delete(`${API}/api/models/${id}`)
    aiModels.value = aiModels.value.filter(m => m.id !== id)
  }

  return { aiModels, loadModels, createModel, updateModel, deleteModel }
})
