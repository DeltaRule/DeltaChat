import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref({})
  const webhooks = ref([])

  async function loadSettings() {
    try {
      const { data } = await axios.get(`${API}/api/settings`)
      settings.value = data
    } catch (e) { console.error(e) }
  }

  async function saveSettings(data) {
    const res = await axios.put(`${API}/api/settings`, data)
    settings.value = res.data
  }

  async function loadWebhooks() {
    try {
      const { data } = await axios.get(`${API}/api/webhooks`)
      webhooks.value = data
    } catch (e) { console.error(e) }
  }

  async function createWebhook(data) {
    const res = await axios.post(`${API}/api/webhooks`, data)
    webhooks.value.push(res.data)
    return res.data
  }

  async function deleteWebhook(id) {
    await axios.delete(`${API}/api/webhooks/${id}`)
    webhooks.value = webhooks.value.filter(w => w.id !== id)
  }

  return { settings, webhooks, loadSettings, saveSettings, loadWebhooks, createWebhook, deleteWebhook }
})
