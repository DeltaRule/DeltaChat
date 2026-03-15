<template>
  <div class="flex flex-col h-full min-h-0 overflow-hidden">
    <!-- Toolbar -->
    <div class="flex items-center h-10 px-4 border-b border-border shrink-0">
      <div v-if="currentChat" class="flex items-center gap-2 max-w-[350px]">
        <MessageSquare class="h-4 w-4 text-muted-foreground" />
        <span
          v-if="!editingTitle"
          class="text-sm font-semibold truncate cursor-pointer hover:text-primary transition-colors"
          @click="startEditTitle"
        >{{ chatTitle || 'Untitled Chat' }}</span>
        <input
          v-else
          ref="titleInput"
          v-model="chatTitle"
          class="text-sm font-semibold bg-transparent border-none outline-none ring-0 w-full"
          placeholder="Chat name…"
          @blur="finishEditTitle"
          @keydown.enter.prevent="finishEditTitle"
          @keydown.escape.prevent="cancelEditTitle"
        />
        <Button v-if="!editingTitle" variant="ghost" size="icon-xs" @click="startEditTitle">
          <Pencil class="h-3 w-3 text-muted-foreground" />
        </Button>
      </div>
      <span v-else class="text-sm text-muted-foreground font-medium">New Conversation</span>
      <div class="flex-1" />
    </div>

    <!-- Messages / welcome screen -->
    <div ref="messagesContainer" class="flex-1 min-h-0 overflow-y-auto px-6 py-4 flex flex-col">
      <template v-if="currentChatMessages.length">
        <ChatMessage
          v-for="msg in currentChatMessages"
          :key="msg.id"
          :message="msg"
          :is-streaming="chatStore.streaming && msg === currentChatMessages[currentChatMessages.length - 1] && msg.role === 'assistant'"
        />
      </template>

      <!-- Welcome greeting -->
      <div v-else-if="!chatStore.currentChatId" class="flex-1 flex flex-col items-center justify-center text-center px-4 relative">
        <div class="absolute w-[500px] h-[500px] rounded-full bg-primary/10 blur-3xl pointer-events-none animate-[pulseGlow_4s_ease-in-out_infinite]" style="top:50%;left:50%;transform:translate(-50%,-55%);"></div>
        <div class="relative mb-6 animate-[float_4s_ease-in-out_infinite]">
          <div class="flex h-20 w-20 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-xl shadow-primary/35">
            <Triangle class="h-12 w-12" />
          </div>
        </div>
        <h1 class="text-3xl font-bold mb-3 gradient-text tracking-tight">Welcome to DeltaChat</h1>
        <p class="text-muted-foreground mb-8 max-w-[440px] leading-relaxed">
          Your AI-powered chat assistant. Type a message below to start a conversation.
        </p>
        <div class="flex flex-wrap justify-center gap-3 animate-[fadeInUp_0.6s_ease-out_0.3s_both]">
          <div
            v-for="action in quickActions"
            :key="action.label"
            class="flex flex-col items-center p-5 rounded-xl border border-border bg-card/50 backdrop-blur-sm cursor-pointer transition-all hover:-translate-y-1 hover:shadow-lg hover:shadow-primary/10 hover:border-primary/25 min-w-[160px]"
            @click="inputMessage = action.prompt"
          >
            <component :is="action.icon" :class="['h-5 w-5 mb-2', action.color]" />
            <div class="text-sm font-medium">{{ action.label }}</div>
            <div class="text-xs text-muted-foreground">{{ action.desc }}</div>
          </div>
        </div>
      </div>

      <!-- Empty chat -->
      <div v-else class="flex-1 flex items-center justify-center">
        <div class="text-center">
          <MessageSquare class="h-16 w-16 text-muted-foreground/30 mx-auto mb-4" />
          <div class="text-lg text-muted-foreground">No messages yet</div>
          <div class="text-sm text-muted-foreground/70 mt-2">Say something to get started</div>
        </div>
      </div>
    </div>

    <!-- Input area -->
    <div class="shrink-0 border-t border-border bg-gradient-to-t from-background to-background/90 backdrop-blur-lg px-4 py-3">
      <div class="max-w-[800px] mx-auto">
        <!-- Model selector -->
        <div class="mb-2">
          <Select v-model="selectedModelId">
            <SelectTrigger class="max-w-[260px]">
              <SelectValue placeholder="Select a model…" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem v-for="m in modelItems" :key="m.value" :value="m.value">{{ m.title }}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <!-- Input box -->
        <div class="bg-muted/50 border border-border rounded-2xl px-3 py-2 transition-all focus-within:border-primary/35 focus-within:shadow-lg focus-within:shadow-primary/10">
          <!-- Attached files strip -->
          <div v-if="attachedFiles.length" class="flex flex-wrap gap-2 mb-2">
            <div
              v-for="(file, i) in attachedFiles"
              :key="i"
              class="flex items-center gap-1.5 bg-background border border-border rounded-lg px-2.5 py-1.5 text-xs max-w-[200px] group"
            >
              <component :is="fileIcon(file)" class="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span class="truncate" :title="file.name">{{ shortenName(file.name) }}</span>
              <button
                class="ml-0.5 text-muted-foreground hover:text-destructive transition-colors shrink-0"
                @click="removeFile(i)"
              >
                <X class="h-3 w-3" />
              </button>
            </div>
          </div>
          <div class="flex items-end gap-2">
            <textarea
              ref="textareaRef"
              v-model="inputMessage"
              placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
              rows="1"
              class="flex-1 bg-transparent border-none outline-none ring-0 resize-none text-sm min-h-[36px] max-h-[150px] py-2"
              @keydown.enter.exact.prevent="sendMessage"
              @input="autoResize"
            />
            <div class="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="icon-sm" class="text-muted-foreground" @click="$refs.fileInput.click()">
                <Paperclip class="h-4 w-4" />
              </Button>
              <Button
                v-if="chatStore.streaming"
                size="icon-sm"
                variant="destructive"
                @click="chatStore.stopStreaming()"
              >
                <Square class="h-3.5 w-3.5" />
              </Button>
              <Button
                v-else
                size="icon-sm"
                :disabled="!canSend"
                @click="sendMessage"
              >
                <Send class="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
        <input ref="fileInput" type="file" multiple class="hidden" @change="handleFileAttach" />
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useChatStore } from '../stores/chat'
import { useModelsStore } from '../stores/models'
import ChatMessage from './ChatMessage.vue'
import { Button } from './ui/button'
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select'
import {
  MessageSquare, Pencil, Bot, Triangle, Send, Square,
  Paperclip, Lightbulb, Code, FileText, X, File, Image, FileSpreadsheet, FileCode
} from 'lucide-vue-next'

const chatStore = useChatStore()
const modelsStore = useModelsStore()

const inputMessage = ref('')
const selectedModelId = ref(localStorage.getItem('deltachat-selected-model') || null)
const chatTitle = ref('')
const editingTitle = ref(false)
const titleInput = ref(null)
const messagesContainer = ref(null)
const fileInput = ref(null)
const textareaRef = ref(null)
const attachedFiles = ref([])

const quickActions = [
  { label: 'Explain a concept', desc: 'Learn something new', prompt: 'Explain quantum computing simply', icon: Lightbulb, color: 'text-primary' },
  { label: 'Write code', desc: 'Generate solutions', prompt: 'Write a Python function to sort a list', icon: Code, color: 'text-green-500' },
  { label: 'Summarize text', desc: 'Condense information', prompt: 'Summarize the key points of...', icon: FileText, color: 'text-blue-500' },
]

const modelItems = computed(() => {
  const models = modelsStore.aiModels.filter(m => m.enabled !== false && m.type !== 'embedding').map(m => ({ title: m.name || 'Unnamed Model', value: m.id }))
  if (!models.length) return [{ title: 'No model selected', value: null }]
  return models
})

const currentChat = computed(() => chatStore.chats.find(c => c.id === chatStore.currentChatId))
const currentChatMessages = computed(() => chatStore.messages[chatStore.currentChatId] || [])
const canSend = computed(() => (inputMessage.value.trim() || attachedFiles.value.length) && !chatStore.streaming)

function shortenName(name, maxLen = 20) {
  if (name.length <= maxLen) return name
  const ext = name.lastIndexOf('.') > 0 ? name.slice(name.lastIndexOf('.')) : ''
  const base = name.slice(0, name.length - ext.length)
  const keep = maxLen - ext.length - 1
  return keep > 0 ? base.slice(0, keep) + '…' + ext : name.slice(0, maxLen - 1) + '…'
}

function fileIcon(file) {
  const t = file.type || ''
  if (t.startsWith('image/')) return Image
  if (t === 'application/pdf' || t.includes('word')) return FileText
  if (t.includes('spreadsheet') || t.includes('csv') || t.includes('excel')) return FileSpreadsheet
  if (t.includes('json') || t.includes('javascript') || t.includes('typescript') || t.includes('html') || t.includes('xml')) return FileCode
  return File
}

function removeFile(index) {
  attachedFiles.value.splice(index, 1)
}

watch(() => currentChat.value, (chat) => {
  if (chat) {
    chatTitle.value = chat.title || ''
    selectedModelId.value = chat.modelId || null
  }
})

watch(selectedModelId, (id) => {
  if (id) localStorage.setItem('deltachat-selected-model', id)
  else localStorage.removeItem('deltachat-selected-model')
})

watch(() => chatStore.currentChatId, async (id) => {
  if (id) await chatStore.loadMessages(id)
})

watch(currentChatMessages, async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}, { deep: true })

function autoResize() {
  const el = textareaRef.value
  if (el) {
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 150) + 'px'
  }
}

async function sendMessage() {
  if (!canSend.value) return
  const text = inputMessage.value.trim()
  const files = [...attachedFiles.value]

  // Build content: text + attachment references
  let content = text
  if (files.length) {
    const attachmentLines = files.map(f => `[Attached: ${f.name}]`).join('\n')
    content = content ? `${content}\n\n${attachmentLines}` : attachmentLines
  }

  inputMessage.value = ''
  attachedFiles.value = []
  if (textareaRef.value) textareaRef.value.style.height = 'auto'

  let chatId = chatStore.currentChatId
  if (!chatId) {
    const autoTitle = text
      ? (text.length > 50 ? text.slice(0, 50) + '…' : text)
      : files.map(f => f.name).join(', ').slice(0, 50)
    const chat = await chatStore.createChat(autoTitle, selectedModelId.value, null)
    chatId = chat.id
    chatStore.currentChatId = chatId
  }
  chatStore.streamMessage(chatId, content, { modelId: selectedModelId.value })
}

async function startEditTitle() {
  editingTitle.value = true
  await nextTick()
  titleInput.value?.focus()
}

async function finishEditTitle() {
  editingTitle.value = false
  if (currentChat.value && chatTitle.value !== currentChat.value.title) {
    await chatStore.updateChat(chatStore.currentChatId, { title: chatTitle.value })
  }
}

function cancelEditTitle() {
  chatTitle.value = currentChat.value?.title || ''
  editingTitle.value = false
}

function handleFileAttach(e) {
  for (const file of e.target.files) {
    attachedFiles.value.push(file)
  }
  // Reset the input so the same file can be re-attached
  e.target.value = ''
}

onMounted(() => modelsStore.loadModels())
</script>
