import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../lib/api'
import { useNotificationStore } from './notification'
import type { SettingsData, Webhook } from '../types'
import { getErrorMessage } from '../types'

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<SettingsData>({})
  const webhooks = ref<Webhook[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function loadSettings(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<SettingsData>('/settings')
      settings.value = data
    } catch (e) {
      error.value = getErrorMessage(e, 'Failed to load settings')
      useNotificationStore().error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function saveSettings(payload: SettingsData): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const res = await api.put<SettingsData>('/settings', payload)
      settings.value = res.data
    } catch (e) {
      error.value = getErrorMessage(e, 'Failed to save settings')
      useNotificationStore().error(error.value)
      throw e
    } finally {
      loading.value = false
    }
  }

  async function loadWebhooks(): Promise<void> {
    try {
      const { data } = await api.get<Webhook[]>('/webhooks')
      webhooks.value = data
    } catch (e) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to load webhooks'))
    }
  }

  async function createWebhook(payload: Partial<Webhook>): Promise<Webhook> {
    try {
      const res = await api.post<Webhook>('/webhooks', payload)
      webhooks.value.push(res.data)
      return res.data
    } catch (e) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to create webhook'))
      throw e
    }
  }

  async function deleteWebhook(id: string): Promise<void> {
    try {
      await api.delete(`/webhooks/${id}`)
      webhooks.value = webhooks.value.filter((w) => w.id !== id)
    } catch (e) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to delete webhook'))
      throw e
    }
  }

  return {
    settings,
    webhooks,
    loading,
    error,
    loadSettings,
    saveSettings,
    loadWebhooks,
    createWebhook,
    deleteWebhook,
  }
})
