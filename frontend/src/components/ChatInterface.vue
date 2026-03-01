<template>
  <div class="chat-layout">
    <!-- ── Main chat area ──────────────────────────────────── -->
    <section class="chat-main">
      <!-- Toolbar -->
      <v-toolbar density="compact" color="transparent" class="chat-toolbar" style="border-bottom: 1px solid rgba(var(--v-border-color), 0.08);">
        <v-toolbar-title>
          <div v-if="currentChat" class="d-flex align-center" style="max-width: 350px;">
            <v-icon icon="mdi-chat-outline" size="18" class="mr-2 text-medium-emphasis" />
            <span
              v-if="!editingTitle"
              class="text-body-2 font-weight-bold text-truncate"
              style="cursor: pointer;"
              @click="startEditTitle"
            >{{ chatTitle || 'Untitled Chat' }}</span>
            <v-text-field
              v-else
              ref="titleInput"
              v-model="chatTitle"
              variant="plain"
              hide-details
              density="compact"
              placeholder="Chat name…"
              style="font-weight: 600;"
              @blur="finishEditTitle"
              @keydown.enter.prevent="finishEditTitle"
              @keydown.escape.prevent="cancelEditTitle"
            />
            <v-btn
              v-if="!editingTitle"
              icon="mdi-pencil-outline"
              variant="text"
              size="x-small"
              class="ml-1 text-medium-emphasis"
              @click="startEditTitle"
            />
          </div>
          <span v-else class="text-body-2 text-medium-emphasis font-weight-medium">New Conversation</span>
        </v-toolbar-title>
        <v-spacer />
      </v-toolbar>

      <!-- Messages / welcome screen -->
      <div ref="messagesContainer" class="chat-messages">
        <template v-if="currentChatMessages.length">
          <ChatMessage
            v-for="msg in currentChatMessages"
            :key="msg.id"
            :message="msg"
          />
          <div v-if="chatStore.streaming" class="d-flex align-center mb-4 message-row" style="max-width: 800px; margin: 0 auto; width: 100%;">
            <v-avatar color="primary" size="34" class="mr-3" rounded="lg" style="box-shadow: 0 2px 8px rgba(124, 77, 255, 0.3);">
              <v-icon icon="mdi-robot" size="20" />
            </v-avatar>
            <div class="message-bubble message-assistant d-flex align-center" style="white-space: nowrap; gap: 8px;">
              <v-progress-circular indeterminate size="16" width="2" color="primary" />
              <span class="text-caption text-medium-emphasis">Thinking…</span>
              <v-btn
                size="x-small"
                variant="text"
                color="error"
                style="min-width: auto;"
                @click="chatStore.stopStreaming()"
              >
                STOP
              </v-btn>
            </div>
          </div>
        </template>

        <!-- Welcome greeting — no chat selected -->
        <div v-else-if="!chatStore.currentChatId" class="welcome-screen">
          <div class="welcome-glow" />
          <div class="welcome-glow-secondary" />
          <div class="welcome-avatar-container">
            <v-avatar color="primary" size="88" rounded="xl" class="mb-6 welcome-avatar">
              <v-icon icon="mdi-delta" size="52" color="white" />
            </v-avatar>
            <div class="welcome-avatar-ring" />
          </div>
          <h1 class="text-h4 font-weight-bold mb-3 gradient-text" style="letter-spacing: -0.5px;">Welcome to DeltaChat</h1>
          <p class="text-body-1 text-medium-emphasis mb-8" style="max-width: 440px; line-height: 1.7;">
            Your AI-powered chat assistant. Type a message below to start a conversation.
          </p>
          <div class="d-flex flex-wrap justify-center ga-3 quick-actions">
            <div class="quick-action-card" @click="inputMessage = 'Explain quantum computing simply'">
              <v-icon icon="mdi-lightbulb-outline" color="primary" size="22" class="mb-2" />
              <div class="text-body-2 font-weight-medium">Explain a concept</div>
              <div class="text-caption text-disabled">Learn something new</div>
            </div>
            <div class="quick-action-card" @click="inputMessage = 'Write a Python function to sort a list'">
              <v-icon icon="mdi-code-tags" color="secondary" size="22" class="mb-2" />
              <div class="text-body-2 font-weight-medium">Write code</div>
              <div class="text-caption text-disabled">Generate solutions</div>
            </div>
            <div class="quick-action-card" @click="inputMessage = 'Summarize the key points of...'">
              <v-icon icon="mdi-text-box-outline" color="info" size="22" class="mb-2" />
              <div class="text-body-2 font-weight-medium">Summarize text</div>
              <div class="text-caption text-disabled">Condense information</div>
            </div>
          </div>
        </div>

        <!-- Empty chat selected but no messages -->
        <div
          v-else
          class="d-flex align-center justify-center text-disabled"
          style="height: 100%; min-height: 200px;"
        >
          <div class="text-center">
            <v-icon icon="mdi-chat-outline" size="64" class="mb-4 text-medium-emphasis" />
            <div class="text-h6 text-medium-emphasis">No messages yet</div>
            <div class="text-body-2 text-disabled mt-2">Say something to get started</div>
          </div>
        </div>
      </div>

      <!-- Input area — always visible -->
      <div class="chat-input-wrapper">
        <v-sheet class="chat-input" color="transparent" rounded="0">
          <!-- Model selector above input -->
          <div class="mb-2">
            <v-select
              v-model="selectedModelId"
              :items="modelItems"
              item-title="name"
              item-value="id"
              density="compact"
              hide-details
              variant="outlined"
              label="Model"
              placeholder="Select a model…"
              style="max-width: 260px;"
              class="model-select"
            >
              <template #selection="{ item }">
                <span class="text-body-2">{{ item.raw.name }}</span>
              </template>
              <template #item="{ item, props: itemProps }">
                <v-list-item v-bind="itemProps" :title="item.raw.name" />
              </template>
            </v-select>
          </div>
          <div class="chat-input-box">
            <v-textarea
              v-model="inputMessage"
              placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
              variant="outlined"
              rows="1"
              auto-grow
              max-rows="6"
              hide-details
              class="chat-textarea"
              @keydown.enter.exact.prevent="sendMessage"
            />
            <div class="chat-input-actions">
              <v-btn
                icon="mdi-attachment"
                variant="text"
                size="small"
                class="text-medium-emphasis"
                @click="$refs.fileInput.click()"
              />
              <v-btn
                icon="mdi-send"
                color="primary"
                size="small"
                variant="tonal"
                :disabled="!inputMessage.trim() || chatStore.streaming"
                @click="sendMessage"
              />
            </div>
          </div>
          <input ref="fileInput" type="file" style="display:none" @change="handleFileAttach" />
        </v-sheet>
      </div>
    </section>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useDisplay } from 'vuetify'
import { useChatStore } from '../stores/chat'
import { useModelsStore } from '../stores/models'
import ChatMessage from './ChatMessage.vue'

const chatStore = useChatStore()
const modelsStore = useModelsStore()
const { mobile } = useDisplay()

const inputMessage = ref('')
const selectedModelId = ref(localStorage.getItem('deltachat-selected-model') || null)
const chatTitle = ref('')
const editingTitle = ref(false)
const titleInput = ref(null)
const messagesContainer = ref(null)
const fileInput = ref(null)

const modelItems = computed(() => {
  const models = modelsStore.aiModels.filter(m => m.enabled !== false).map(m => ({ name: m.name || 'Unnamed Model', id: m.id }))
  // Only show "No model selected" if there are no models at all
  if (!models.length) return [{ name: 'No model selected', id: null }]
  return models
})

const currentChat = computed(() =>
  chatStore.chats.find(c => c.id === chatStore.currentChatId)
)
const currentChatMessages = computed(() =>
  chatStore.messages[chatStore.currentChatId] || []
)

// Sync title and model when current chat changes
watch(() => currentChat.value, (chat) => {
  if (chat) {
    chatTitle.value = chat.title || ''
    selectedModelId.value = chat.modelId || null
  }
})

// Persist model selection to localStorage
watch(selectedModelId, (id) => {
  if (id) {
    localStorage.setItem('deltachat-selected-model', id)
  } else {
    localStorage.removeItem('deltachat-selected-model')
  }
})

// Load messages when currentChatId changes
watch(() => chatStore.currentChatId, async (id) => {
  if (id) await chatStore.loadMessages(id)
})

// Scroll to bottom on new messages
watch(currentChatMessages, async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}, { deep: true })

async function sendMessage() {
  if (!inputMessage.value.trim() || chatStore.streaming) return
  const content = inputMessage.value.trim()
  inputMessage.value = ''

  // Auto-create a new chat if none is selected; use first message as title
  let chatId = chatStore.currentChatId
  if (!chatId) {
    const autoTitle = content.length > 50 ? content.slice(0, 50) + '…' : content
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
  const file = e.target.files[0]
  if (file) inputMessage.value += ` [Attached: ${file.name}]`
}

onMounted(async () => {
  await modelsStore.loadModels()
})
</script>

<style scoped>
.chat-layout {
  --app-bar-height: 48px;
  display: flex;
  height: calc(100vh - var(--app-bar-height));
  overflow: hidden;
}

.chat-main {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  overflow: hidden;
}

.chat-toolbar {
  flex-shrink: 0;
}

.chat-messages {
  flex: 1;
  overflow-y: auto;
  padding: 24px 24px 16px;
  display: flex;
  flex-direction: column;
}

.welcome-screen {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 32px 16px;
  position: relative;
}

.welcome-glow {
  position: absolute;
  width: 500px;
  height: 500px;
  background: radial-gradient(circle, rgba(124, 77, 255, 0.15) 0%, rgba(124, 77, 255, 0.05) 40%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -55%);
  animation: pulseGlow 4s ease-in-out infinite;
}

.welcome-glow-secondary {
  position: absolute;
  width: 350px;
  height: 350px;
  background: radial-gradient(circle, rgba(3, 218, 198, 0.08) 0%, transparent 70%);
  border-radius: 50%;
  pointer-events: none;
  top: 45%;
  left: 55%;
  transform: translate(-50%, -50%);
  animation: pulseGlow 5s ease-in-out infinite reverse;
}

.welcome-avatar-container {
  position: relative;
  display: flex;
  justify-content: center;
  animation: float 4s ease-in-out infinite;
}

.welcome-avatar {
  box-shadow: 0 8px 32px rgba(124, 77, 255, 0.35), 0 0 0 1px rgba(124, 77, 255, 0.15);
  z-index: 1;
}

.welcome-avatar-ring {
  position: absolute;
  top: -8px;
  left: 50%;
  transform: translateX(-50%);
  width: 104px;
  height: 104px;
  border-radius: 20px;
  border: 2px solid rgba(124, 77, 255, 0.15);
  animation: pulseGlow 3s ease-in-out infinite;
  pointer-events: none;
}

.quick-actions {
  animation: fadeInUp 0.6s ease-out 0.3s both;
}

.quick-action-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px 24px;
  border-radius: 16px;
  border: 1px solid rgba(var(--v-border-color), 0.1);
  background: rgba(var(--v-theme-surface-variant), 0.3);
  cursor: pointer;
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  min-width: 160px;
  backdrop-filter: blur(8px);
}

.quick-action-card:hover {
  background: rgba(var(--v-theme-surface-variant), 0.6);
  border-color: rgba(124, 77, 255, 0.25);
  transform: translateY(-4px);
  box-shadow: 0 8px 24px rgba(124, 77, 255, 0.12);
}

.v-theme--light .quick-action-card {
  background: rgba(255, 255, 255, 0.8);
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.v-theme--light .quick-action-card:hover {
  background: white;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08);
}

/* Input area */
.chat-input-wrapper {
  flex-shrink: 0;
  border-top: 1px solid rgba(var(--v-border-color), 0.06);
  background: linear-gradient(to top, rgb(var(--v-theme-surface)) 60%, rgba(var(--v-theme-surface), 0.9));
  backdrop-filter: blur(12px);
  padding: 12px 16px 20px;
}

.chat-input {
  max-width: 800px;
  margin: 0 auto;
}

.chat-input-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(var(--v-theme-surface-variant), 0.4);
  border-radius: 20px;
  padding: 8px 12px 8px 8px;
  border: 1px solid rgba(var(--v-border-color), 0.08);
  transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.08);
}

.chat-input-box:focus-within {
  border-color: rgba(124, 77, 255, 0.35);
  box-shadow: 0 4px 20px rgba(124, 77, 255, 0.1), 0 2px 12px rgba(0, 0, 0, 0.08);
  background: rgba(var(--v-theme-surface-variant), 0.6);
}

.chat-textarea {
  flex: 1;
  min-height: 0;
}

.chat-textarea :deep(.v-field__outline) {
  display: none;
}

.chat-textarea :deep(.v-field) {
  background: transparent;
  padding-top: 4px;
  padding-bottom: 4px;
  min-height: 36px;
}

.chat-textarea :deep(.v-field__field) {
  align-items: center;
}

.chat-textarea :deep(textarea) {
  margin-top: 0 !important;
  margin-bottom: 0 !important;
}

.chat-input-actions {
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
}

.model-select :deep(.v-field) {
  border-radius: 10px;
}
</style>
