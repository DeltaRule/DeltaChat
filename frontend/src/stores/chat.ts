import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { io } from 'socket.io-client'
import { useNotificationStore } from './notification'
import api, { API_URL } from '../lib/api'
import type { Chat, ChatMessage } from '../types'

interface StreamOpts {
  modelId?: string | null
  [key: string]: unknown
}

export const useChatStore = defineStore('chat', () => {
  const chats = ref<Chat[]>([])
  const currentChatId = ref<string | null>(null)
  const messages: Record<string, ChatMessage[]> = reactive({})
  const streaming = ref(false)
  const streamError = ref<string | null>(null)
  const socket = io(API_URL, {
    autoConnect: true,
    auth: { token: localStorage.getItem('deltachat-token') || '' },
  })
  let _streamTimeout: ReturnType<typeof setTimeout> | null = null

  function reconnectSocket(): void {
    socket.auth = { token: localStorage.getItem('deltachat-token') || '' }
    if (socket.connected) {
      socket.disconnect().connect()
    }
  }

  async function loadChats(): Promise<void> {
    try {
      const { data } = await api.get<Chat[]>('/chats')
      chats.value = data
    } catch (e) {
      console.error(e)
    }
  }

  async function createChat(
    title: string,
    modelId: string | null,
    folder: string | null,
  ): Promise<Chat> {
    const { data } = await api.post<Chat>('/chats', {
      title: title || '',
      modelId: modelId || null,
      folder: folder || null,
    })
    chats.value.unshift(data)
    return data
  }

  async function updateChat(id: string | null, fields: Partial<Chat>): Promise<Chat> {
    const { data } = await api.patch<Chat>(`/chats/${id}`, fields)
    const idx = chats.value.findIndex((c) => c.id === id)
    if (idx !== -1) chats.value[idx] = data
    return data
  }

  async function deleteChat(id: string): Promise<void> {
    await api.delete(`/chats/${id}`)
    chats.value = chats.value.filter((c) => c.id !== id)
    if (currentChatId.value === id) currentChatId.value = null
  }

  async function loadMessages(chatId: string): Promise<void> {
    if (streaming.value && messages[chatId]?.length) return
    try {
      const { data } = await api.get<{ messages: ChatMessage[] }>(`/chats/${chatId}`)
      if (!streaming.value) {
        messages[chatId] = data.messages || []
      }
    } catch (e) {
      messages[chatId] = []
    }
  }

  async function sendMessage(
    chatId: string,
    content: string,
    opts: StreamOpts = {},
  ): Promise<ChatMessage> {
    const userMsg: ChatMessage = { role: 'user', content, id: Date.now() }
    if (!messages[chatId]) messages[chatId] = []
    messages[chatId].push(userMsg)
    const { data } = await api.post<ChatMessage>(`/chats/${chatId}/messages`, { content, ...opts })
    messages[chatId].push(data)
    return data
  }

  function _cleanupStreamListeners(): void {
    socket.off('chat:chunk')
    socket.off('chat:done')
    socket.off('chat:error')
    if (_streamTimeout) {
      clearTimeout(_streamTimeout)
      _streamTimeout = null
    }
  }

  function stopStreaming(): void {
    _cleanupStreamListeners()
    streaming.value = false
  }

  function streamMessage(chatId: string, content: string, opts: StreamOpts = {}): void {
    if (!messages[chatId] || !messages[chatId].length) messages[chatId] = []
    const userMsg: ChatMessage = { role: 'user', content, id: Date.now() }
    messages[chatId].push(userMsg)
    streaming.value = true
    streamError.value = null
    const assistantMsg: ChatMessage & { error?: boolean } = {
      role: 'assistant',
      content: '',
      id: Date.now() + 1,
    }
    messages[chatId].push(assistantMsg)
    const idx = messages[chatId].length - 1

    _cleanupStreamListeners()

    socket.emit('chat:send', { chatId, content, ...opts })

    socket.on('chat:chunk', ({ chunk }: { chunk: string }) => {
      messages[chatId][idx].content += chunk
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

    socket.on(
      'chat:done',
      ({
        message: doneMsg,
        sources,
      }: { message?: Partial<ChatMessage>; sources?: ChatMessage['sources'] } = {}) => {
        streaming.value = false
        _cleanupStreamListeners()
        if (doneMsg && messages[chatId][idx]) {
          messages[chatId][idx] = { ...messages[chatId][idx], ...doneMsg }
          if (sources?.length) {
            messages[chatId][idx].sources = sources
          }
        }
      },
    )

    socket.on('chat:error', ({ error: errMsg }: { error?: string }) => {
      streaming.value = false
      streamError.value = errMsg || 'An error occurred while generating the response.'
      _cleanupStreamListeners()
      if (messages[chatId][idx]) {
        messages[chatId][idx].content = messages[chatId][idx].content || ''
        ;(messages[chatId][idx] as ChatMessage & { error?: boolean }).error = true
      }
      const notify = useNotificationStore()
      notify.error(errMsg || 'Failed to get AI response. Please try again.')
    })

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

  return {
    chats,
    currentChatId,
    messages,
    streaming,
    streamError,
    loadChats,
    createChat,
    updateChat,
    deleteChat,
    loadMessages,
    sendMessage,
    streamMessage,
    stopStreaming,
    reconnectSocket,
  }
})
