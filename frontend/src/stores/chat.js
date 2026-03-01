import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import axios from 'axios'
import { io } from 'socket.io-client'
import { useNotificationStore } from './notification'

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'

export const useChatStore = defineStore('chat', () => {
  const chats = ref([])
  const currentChatId = ref(null)
  const messages = reactive({})
  const streaming = ref(false)
  const streamError = ref(null)
  const socket = io(API, { autoConnect: true })
  let _streamTimeout = null

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
    // Don't reload if we already have messages being streamed for this chat
    if (streaming.value && messages[chatId]?.length) return
    try {
      const { data } = await axios.get(`${API}/api/chats/${chatId}`)
      // Only replace if we're not currently streaming (streaming adds messages client-side)
      if (!streaming.value) {
        messages[chatId] = data.messages || []
      }
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

  function _cleanupStreamListeners() {
    socket.off('chat:chunk')
    socket.off('chat:done')
    socket.off('chat:error')
    if (_streamTimeout) {
      clearTimeout(_streamTimeout)
      _streamTimeout = null
    }
  }

  function stopStreaming() {
    _cleanupStreamListeners()
    streaming.value = false
  }

  function streamMessage(chatId, content, opts = {}) {
    // Ensure we start fresh for a newly created chat — don't inherit stale data
    if (!messages[chatId] || !messages[chatId].length) messages[chatId] = []
    const userMsg = { role: 'user', content, id: Date.now() }
    messages[chatId].push(userMsg)
    streaming.value = true
    streamError.value = null
    const assistantMsg = { role: 'assistant', content: '', id: Date.now() + 1 }
    messages[chatId].push(assistantMsg)
    const idx = messages[chatId].length - 1

    _cleanupStreamListeners()

    socket.emit('chat:send', { chatId, content, ...opts })

    socket.on('chat:chunk', ({ chunk }) => {
      messages[chatId][idx].content += chunk
      // Reset timeout on each chunk received
      if (_streamTimeout) clearTimeout(_streamTimeout)
      _streamTimeout = setTimeout(() => {
        if (streaming.value) {
          streaming.value = false
          streamError.value = 'Response timed out — no data received for 60 seconds.'
          const notify = useNotificationStore()
          notify.error('AI response timed out. Please try again.')
          _cleanupStreamListeners()
        }
      }, 60000)
    })

    socket.on('chat:done', ({ message: doneMsg } = {}) => {
      streaming.value = false
      _cleanupStreamListeners()
      // Update the assistant message with server data if available
      if (doneMsg && messages[chatId][idx]) {
        messages[chatId][idx] = { ...messages[chatId][idx], ...doneMsg }
      }
    })

    socket.on('chat:error', ({ error: errMsg }) => {
      streaming.value = false
      streamError.value = errMsg || 'An error occurred while generating the response.'
      _cleanupStreamListeners()
      // Update assistant message to show error
      if (messages[chatId][idx]) {
        messages[chatId][idx].content = messages[chatId][idx].content || ''
        messages[chatId][idx].error = true
      }
      const notify = useNotificationStore()
      notify.error(errMsg || 'Failed to get AI response. Please try again.')
    })

    // Initial timeout — if no chunk arrives within 60 seconds
    _streamTimeout = setTimeout(() => {
      if (streaming.value) {
        streaming.value = false
        streamError.value = 'Response timed out — the AI did not respond within 60 seconds.'
        const notify = useNotificationStore()
        notify.error('AI response timed out. Please try again.')
        _cleanupStreamListeners()
      }
    }, 60000)
  }

  return { chats, currentChatId, messages, streaming, streamError, loadChats, createChat, updateChat, deleteChat, loadMessages, sendMessage, streamMessage, stopStreaming }
})
