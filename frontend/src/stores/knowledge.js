import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../lib/api'
import { useNotificationStore } from './notification'

export const useKnowledgeStore = defineStore('knowledge', () => {
  const knowledgeStores = ref([])
  const documents = ref({})
  const _pollTimers = {}

  function _errorMsg(e, fallback) {
    return e?.response?.data?.error || e?.message || fallback
  }

  async function loadKnowledgeStores() {
    try {
      const { data } = await api.get('/knowledge')
      knowledgeStores.value = data
    } catch (e) {
      console.error(e)
      useNotificationStore().error(_errorMsg(e, 'Failed to load knowledge stores'))
    }
  }

  async function createKnowledgeStore(name, description, opts = {}) {
    try {
      const { data } = await api.post('/knowledge', {
        name, description,
        embeddingModelId: opts.embeddingModelId || null,
        vectorStoreConfig: opts.vectorStoreConfig || null,
        documentProcessorConfig: opts.documentProcessorConfig || null,
        chunkSize: opts.chunkSize || null,
        chunkOverlap: opts.chunkOverlap || null,
        chunkUnit: opts.chunkUnit || null,
      })
      knowledgeStores.value.push(data)
      return data
    } catch (e) {
      console.error(e)
      useNotificationStore().error(_errorMsg(e, 'Failed to create knowledge store'))
      throw e
    }
  }

  async function deleteKnowledgeStore(id) {
    try {
      _stopPolling(id)
      await api.delete(`/knowledge/${id}`)
      knowledgeStores.value = knowledgeStores.value.filter(k => k.id !== id)
    } catch (e) {
      console.error(e)
      useNotificationStore().error(_errorMsg(e, 'Failed to delete knowledge store'))
      throw e
    }
  }

  async function loadDocuments(ksId) {
    try {
      const { data } = await api.get(`/knowledge/${ksId}/documents`)
      documents.value[ksId] = data
      // Check if any documents are still processing and start/stop polling accordingly
      const hasProcessing = data.some(d => d.status === 'processing')
      if (hasProcessing) _startPolling(ksId)
      else _stopPolling(ksId)
    } catch (e) {
      documents.value[ksId] = []
      useNotificationStore().error(_errorMsg(e, 'Failed to load documents'))
    }
  }

  async function uploadDocument(ksId, file) {
    try {
      const form = new FormData()
      form.append('file', file)
      const { data } = await api.post(`/knowledge/${ksId}/documents`, form, {
        headers: { 'Content-Type': 'multipart/form-data' }
      })
      if (!documents.value[ksId]) documents.value[ksId] = []
      documents.value[ksId].push(data)
      // Start polling for status updates
      _startPolling(ksId)
      return data
    } catch (e) {
      console.error(e)
      useNotificationStore().error(_errorMsg(e, `Failed to upload "${file.name}"`))
      throw e
    }
  }

  async function deleteDocument(ksId, docId) {
    try {
      await api.delete(`/knowledge/${ksId}/documents/${docId}`)
      if (documents.value[ksId]) {
        documents.value[ksId] = documents.value[ksId].filter(d => d.id !== docId)
      }
    } catch (e) {
      console.error(e)
      useNotificationStore().error(_errorMsg(e, 'Failed to delete document'))
      throw e
    }
  }

  function _startPolling(ksId) {
    if (_pollTimers[ksId]) return // already polling
    _pollTimers[ksId] = setInterval(async () => {
      try {
        const { data } = await api.get(`/knowledge/${ksId}/documents`)
        documents.value[ksId] = data
        const hasProcessing = data.some(d => d.status === 'processing')
        if (!hasProcessing) {
          _stopPolling(ksId)
          // Also refresh the store list to update document counts
          await loadKnowledgeStores()
        }
      } catch {
        _stopPolling(ksId)
      }
    }, 3000)
  }

  function _stopPolling(ksId) {
    if (_pollTimers[ksId]) {
      clearInterval(_pollTimers[ksId])
      delete _pollTimers[ksId]
    }
  }

  return { knowledgeStores, documents, loadKnowledgeStores, createKnowledgeStore, deleteKnowledgeStore, loadDocuments, uploadDocument, deleteDocument }
})
