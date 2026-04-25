import { defineStore } from 'pinia'
import { ref, reactive } from 'vue'
import { io } from 'socket.io-client'
import { useNotificationStore } from './notification'
import { useAuthStore } from './auth'
import api, { API_URL } from '../lib/api'
import { setupMcpRelay } from '../composables/useMcpRelay'
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
  const loading = ref(false)
  const error = ref<string | null>(null)
  // Socket starts disconnected — token is not in localStorage (it lives only in Pinia memory).
  // Call reconnectSocket() after login / page-load token refresh to authenticate.
  const socket = io(API_URL, {
    autoConnect: false,
    auth: { token: '' },
  })
  let _streamTimeout: ReturnType<typeof setTimeout> | null = null
  let _relayCleanup: (() => void) | null = null

  // Register MCP relay listeners once the socket is connected so client-scope
  // MCP tools can be executed during chat without additional setup.
  socket.on('connect', () => {
    if (_relayCleanup) _relayCleanup()
    _relayCleanup = setupMcpRelay(socket as unknown as import('socket.io-client').Socket)
  })
  socket.on('disconnect', () => {
    if (_relayCleanup) {
      _relayCleanup()
      _relayCleanup = null
    }
  })

  /**
   * (Re)connect the socket using the current in-memory access token.
   * Call this after login, token refresh, or logout.
   */
  function reconnectSocket(): void {
    let token = ''
    try {
      token = useAuthStore().token || ''
    } catch {
      /* store not ready yet */
    }
    socket.auth = { token }
    if (socket.connected) {
      socket.disconnect().connect()
    } else {
      socket.connect()
    }
  }

  function disconnectSocket(): void {
    if (socket.connected) socket.disconnect()
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
    try {
      const { data } = await api.post<Chat>('/chats', {
        title: title || '',
        modelId: modelId || null,
        folder: folder || null,
      })
      chats.value.unshift(data)
      return data
    } catch (e: unknown) {
      useNotificationStore().error(e instanceof Error ? e.message : 'Failed to create chat')
      throw e
    }
  }

  async function updateChat(id: string | null, fields: Partial<Chat>): Promise<Chat> {
    try {
      const { data } = await api.patch<Chat>(`/chats/${id}`, fields)
      const idx = chats.value.findIndex((c) => c.id === id)
      if (idx !== -1) chats.value[idx] = data
      return data
    } catch (e: unknown) {
      useNotificationStore().error(e instanceof Error ? e.message : 'Failed to update chat')
      throw e
    }
  }

  async function deleteChat(id: string): Promise<void> {
    try {
      await api.delete(`/chats/${id}`)
      chats.value = chats.value.filter((c) => c.id !== id)
      if (currentChatId.value === id) currentChatId.value = null
    } catch (e: unknown) {
      useNotificationStore().error(e instanceof Error ? e.message : 'Failed to delete chat')
      throw e
    }
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
    try {
      const { data } = await api.post<ChatMessage>(`/chats/${chatId}/messages`, {
        content,
        ...opts,
      })
      messages[chatId].push(data)
      return data
    } catch (e: unknown) {
      useNotificationStore().error(e instanceof Error ? e.message : 'Failed to send message')
      throw e
    }
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
    loading,
    error,
    loadChats,
    createChat,
    updateChat,
    deleteChat,
    loadMessages,
    sendMessage,
    streamMessage,
    stopStreaming,
    reconnectSocket,
    disconnectSocket,
  }
})
