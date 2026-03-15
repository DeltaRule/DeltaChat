import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../lib/api'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref({})
  const webhooks = ref([])

  async function loadSettings() {
    try {
      const { data } = await api.get('/settings')
      settings.value = data
    } catch (e) { console.error(e) }
  }

  async function saveSettings(data) {
    const res = await api.put('/settings', data)
    settings.value = res.data
  }

  async function loadWebhooks() {
    try {
      const { data } = await api.get('/webhooks')
      webhooks.value = data
    } catch (e) { console.error(e) }
  }

  async function createWebhook(data) {
    const res = await api.post('/webhooks', data)
    webhooks.value.push(res.data)
    return res.data
  }

  async function deleteWebhook(id) {
    await api.delete(`/webhooks/${id}`)
    webhooks.value = webhooks.value.filter(w => w.id !== id)
  }

  return { settings, webhooks, loadSettings, saveSettings, loadWebhooks, createWebhook, deleteWebhook }
})
