import { defineStore } from 'pinia'
import { ref } from 'vue'
import axios from 'axios'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const useKnowledgeStore = defineStore('knowledge', () => {
  const knowledgeStores = ref([])
  const documents = ref({})

  async function loadKnowledgeStores() {
    try {
      const { data } = await axios.get(`${API}/api/knowledge`)
      knowledgeStores.value = data
    } catch (e) { console.error(e) }
  }

  async function createKnowledgeStore(name, description) {
    const { data } = await axios.post(`${API}/api/knowledge`, { name, description })
    knowledgeStores.value.push(data)
    return data
  }

  async function deleteKnowledgeStore(id) {
    await axios.delete(`${API}/api/knowledge/${id}`)
    knowledgeStores.value = knowledgeStores.value.filter(k => k.id !== id)
  }

  async function loadDocuments(ksId) {
    try {
      const { data } = await axios.get(`${API}/api/knowledge/${ksId}/documents`)
      documents.value[ksId] = data
    } catch (e) { documents.value[ksId] = [] }
  }

  async function uploadDocument(ksId, file) {
    const form = new FormData()
    form.append('file', file)
    const { data } = await axios.post(`${API}/api/knowledge/${ksId}/documents`, form, {
      headers: { 'Content-Type': 'multipart/form-data' }
    })
    if (!documents.value[ksId]) documents.value[ksId] = []
    documents.value[ksId].push(data)
    return data
  }

  async function deleteDocument(ksId, docId) {
    await axios.delete(`${API}/api/knowledge/${ksId}/documents/${docId}`)
    if (documents.value[ksId]) {
      documents.value[ksId] = documents.value[ksId].filter(d => d.id !== docId)
    }
  }

  return { knowledgeStores, documents, loadKnowledgeStores, createKnowledgeStore, deleteKnowledgeStore, loadDocuments, uploadDocument, deleteDocument }
})
