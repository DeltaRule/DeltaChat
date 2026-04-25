import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../lib/api'
import { useNotificationStore } from './notification'
import type { KnowledgeStore, KnowledgeDocument } from '../types'
import { getErrorMessage } from '../types'

interface CreateKnowledgeStoreOpts {
  embeddingModelId?: string | null
  vectorStoreConfig?: Record<string, unknown> | null
  documentProcessorConfig?: Record<string, unknown> | null
  chunkSize?: number | null
  chunkOverlap?: number | null
  chunkUnit?: string | null
}

export const useKnowledgeStore = defineStore('knowledge', () => {
  const knowledgeStores = ref<KnowledgeStore[]>([])
  const documents = ref<Record<string, KnowledgeDocument[]>>({})
  const loading = ref(false)
  const error = ref<string | null>(null)
  const _pollTimers = new Map<string, ReturnType<typeof setInterval>>()

  async function loadKnowledgeStores(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<KnowledgeStore[]>('/knowledge')
      knowledgeStores.value = data
    } catch (e: unknown) {
      error.value = getErrorMessage(e, 'Failed to load knowledge stores')
      useNotificationStore().error(error.value)
    } finally {
      loading.value = false
    }
  }

  async function createKnowledgeStore(
    name: string,
    description: string,
    opts: CreateKnowledgeStoreOpts = {},
  ): Promise<KnowledgeStore> {
    try {
      const { data } = await api.post<KnowledgeStore>('/knowledge', {
        name,
        description,
        embeddingModelId: opts.embeddingModelId || null,
        vectorStoreConfig: opts.vectorStoreConfig || null,
        documentProcessorConfig: opts.documentProcessorConfig || null,
        chunkSize: opts.chunkSize || null,
        chunkOverlap: opts.chunkOverlap || null,
        chunkUnit: opts.chunkUnit || null,
      })
      knowledgeStores.value.push(data)
      return data
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to create knowledge store'))
      throw e
    }
  }

  async function deleteKnowledgeStore(id: string): Promise<void> {
    try {
      _stopPolling(id)
      await api.delete(`/knowledge/${id}`)
      knowledgeStores.value = knowledgeStores.value.filter((k) => k.id !== id)
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to delete knowledge store'))
      throw e
    }
  }

  async function loadDocuments(ksId: string): Promise<void> {
    try {
      const { data } = await api.get<KnowledgeDocument[]>(`/knowledge/${ksId}/documents`)
      documents.value[ksId] = data
      const hasProcessing = data.some((d: KnowledgeDocument) => d.status === 'processing')
      if (hasProcessing) _startPolling(ksId)
      else _stopPolling(ksId)
    } catch (e: unknown) {
      documents.value[ksId] = []
      useNotificationStore().error(getErrorMessage(e, 'Failed to load documents'))
    }
  }

  async function uploadDocument(ksId: string, file: File): Promise<KnowledgeDocument> {
    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await api.post<KnowledgeDocument>(`/knowledge/${ksId}/documents`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      })
      if (!documents.value[ksId]) documents.value[ksId] = []
      documents.value[ksId].push(data)
      _startPolling(ksId)
      return data
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, `Failed to upload "${file.name}"`))
      throw e
    }
  }

  async function deleteDocument(ksId: string, docId: string): Promise<void> {
    try {
      await api.delete(`/knowledge/${ksId}/documents/${docId}`)
      if (documents.value[ksId]) {
        documents.value[ksId] = documents.value[ksId].filter((d) => d.id !== docId)
      }
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to delete document'))
      throw e
    }
  }

  async function downloadDocument(ksId: string, docId: string, filename: string): Promise<void> {
    try {
      const { data } = await api.get(`/knowledge/${ksId}/documents/${docId}/download`, {
        responseType: 'blob',
      })
      const url = URL.createObjectURL(data as Blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename || 'document'
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to download document'))
    }
  }

  function _startPolling(ksId: string): void {
    if (_pollTimers.has(ksId)) return
    const timer = setInterval(async () => {
      try {
        const { data } = await api.get<KnowledgeDocument[]>(`/knowledge/${ksId}/documents`)
        documents.value[ksId] = data
        const hasProcessing = data.some((d: KnowledgeDocument) => d.status === 'processing')
        if (!hasProcessing) {
          _stopPolling(ksId)
          await loadKnowledgeStores()
        }
      } catch {
        _stopPolling(ksId)
      }
    }, 3000)
    _pollTimers.set(ksId, timer)
  }

  function _stopPolling(ksId: string): void {
    const timer = _pollTimers.get(ksId)
    if (timer !== undefined) {
      clearInterval(timer)
      _pollTimers.delete(ksId)
    }
  }

  function stopAllPolling(): void {
    _pollTimers.forEach((timer) => clearInterval(timer))
    _pollTimers.clear()
  }

  return {
    knowledgeStores,
    documents,
    loading,
    error,
    loadKnowledgeStores,
    createKnowledgeStore,
    deleteKnowledgeStore,
    loadDocuments,
    uploadDocument,
    deleteDocument,
    downloadDocument,
    stopAllPolling,
  }
})
