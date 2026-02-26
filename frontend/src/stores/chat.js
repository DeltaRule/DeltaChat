import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import axios from 'axios'
import { io } from 'socket.io-client'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const useChatStore = defineStore('chat', () => {
  const chats = ref([])
  const currentChatId = ref(null)
  const messages = reactive({})
  const streaming = ref(false)
  const socket = io(API, { autoConnect: true })

  async function loadChats() {
    try {
      const { data } = await axios.get(`${API}/api/chats`)
      chats.value = data
    } catch (e) { console.error(e) }
  }

  async function createChat(title, modelId, folder) {
    const { data } = await axios.post(`${API}/api/chats`, {
      title: title || '',
      modelId: modelId || null,
      folder: folder || null,
    })
    chats.value.unshift(data)
    return data
  }

  async function updateChat(id, fields) {
    const { data } = await axios.patch(`${API}/api/chats/${id}`, fields)
    const idx = chats.value.findIndex(c => c.id === id)
    if (idx !== -1) chats.value[idx] = data
    return data
  }

  async function deleteChat(id) {
    await axios.delete(`${API}/api/chats/${id}`)
    chats.value = chats.value.filter(c => c.id !== id)
    if (currentChatId.value === id) currentChatId.value = null
  }

  async function loadMessages(chatId) {
    try {
      const { data } = await axios.get(`${API}/api/chats/${chatId}`)
      messages[chatId] = data.messages || []
    } catch (e) { messages[chatId] = [] }
  }

  async function sendMessage(chatId, content, opts = {}) {
    const userMsg = { role: 'user', content, id: Date.now() }
    if (!messages[chatId]) messages[chatId] = []
    messages[chatId].push(userMsg)
    const { data } = await axios.post(`${API}/api/chats/${chatId}/messages`, { content, ...opts })
    messages[chatId].push(data)
    return data
  }

  function streamMessage(chatId, content, opts = {}) {
    if (!messages[chatId]) messages[chatId] = []
    const userMsg = { role: 'user', content, id: Date.now() }
    messages[chatId].push(userMsg)
    streaming.value = true
    const assistantMsg = { role: 'assistant', content: '', id: Date.now() + 1 }
    messages[chatId].push(assistantMsg)
    const idx = messages[chatId].length - 1

    socket.emit('chat:send', { chatId, content, ...opts })
    socket.off('chat:chunk')
    socket.off('chat:done')
    socket.on('chat:chunk', ({ chunk }) => { messages[chatId][idx].content += chunk })
    socket.on('chat:done', () => { streaming.value = false })
  }

  return { chats, currentChatId, messages, streaming, loadChats, createChat, updateChat, deleteChat, loadMessages, sendMessage, streamMessage }
})
