import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../lib/api'
import type { SettingsData, Webhook } from '../types'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<SettingsData>({})
  const webhooks = ref<Webhook[]>([])

  async function loadSettings(): Promise<void> {
    try {
      const { data } = await api.get<SettingsData>('/settings')
      settings.value = data
    } catch (e) {
      console.error(e)
    }
  }

  async function saveSettings(payload: SettingsData): Promise<void> {
    const res = await api.put<SettingsData>('/settings', payload)
    settings.value = res.data
  }

  async function loadWebhooks(): Promise<void> {
    try {
      const { data } = await api.get<Webhook[]>('/webhooks')
      webhooks.value = data
    } catch (e) {
      console.error(e)
    }
  }

  async function createWebhook(payload: Partial<Webhook>): Promise<Webhook> {
    const res = await api.post<Webhook>('/webhooks', payload)
    webhooks.value.push(res.data)
    return res.data
  }

  async function deleteWebhook(id: string): Promise<void> {
    await api.delete(`/webhooks/${id}`)
    webhooks.value = webhooks.value.filter((w) => w.id !== id)
  }

  return {
    settings,
    webhooks,
    loadSettings,
    saveSettings,
    loadWebhooks,
    createWebhook,
    deleteWebhook,
  }
})
