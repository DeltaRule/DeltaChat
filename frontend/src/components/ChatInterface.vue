<template>
  <div class="chat-layout">
    <!-- ── Main chat area ──────────────────────────────────── -->
    <section class="chat-main">
      <!-- Toolbar -->
      <v-toolbar density="compact" color="surface" border="b" class="chat-toolbar">
        <v-toolbar-title>
          <v-text-field
            v-if="currentChat"
            v-model="chatTitle"
            variant="plain"
            hide-details
            density="compact"
            placeholder="Chat name…"
            @blur="updateChatTitle"
            style="max-width: 200px"
          />
          <span v-else class="text-body-2 text-disabled">New Conversation</span>
        </v-toolbar-title>
        <v-spacer />
        <!-- Model selector — always visible on desktop -->
        <v-select
          v-model="selectedModelId"
          :items="modelItems"
          item-title="name"
          item-value="id"
          density="compact"
          hide-details
          variant="outlined"
          label="Model"
          style="max-width: 180px"
          class="mr-1 d-none d-sm-flex"
        />
      </v-toolbar>

      <!-- Messages / welcome screen -->
      <div ref="messagesContainer" class="chat-messages">
        <template v-if="currentChatMessages.length">
          <ChatMessage
            v-for="msg in currentChatMessages"
            :key="msg.id"
            :message="msg"
          />
          <div v-if="chatStore.streaming" class="d-flex align-center mb-3">
            <v-avatar color="primary" size="32" class="mr-2">
              <v-icon icon="mdi-robot" size="20" />
            </v-avatar>
            <v-card color="surface" variant="outlined" class="pa-3" rounded="lg">
              <v-progress-circular indeterminate size="16" width="2" color="primary" class="mr-2" />
              <span class="text-caption">Thinking…</span>
            </v-card>
          </div>
        </template>

        <!-- Welcome greeting — no chat selected -->
        <div v-else-if="!chatStore.currentChatId" class="welcome-screen">
          <v-avatar color="primary" size="72" rounded="lg" class="mb-5">
            <v-icon icon="mdi-delta" size="44" color="white" />
          </v-avatar>
          <h1 class="text-h5 font-weight-bold mb-2">Welcome to DeltaChat</h1>
          <p class="text-body-2 text-disabled">
            Type a message below to start a new conversation.
          </p>
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
      <v-sheet class="chat-input" border="t" color="surface">
        <!-- Mobile: model selector above input -->
        <div v-if="mobile" class="mb-2">
          <v-select
            v-model="selectedModelId"
            :items="modelItems"
            item-title="name"
            item-value="id"
            density="compact"
            hide-details
            variant="outlined"
            label="Model"
          />
        </div>
        <v-row no-gutters align="end">
          <v-col>
            <v-textarea
              v-model="inputMessage"
              placeholder="Type a message… (Enter to send, Shift+Enter for newline)"
              variant="outlined"
              rows="1"
              auto-grow
              max-rows="6"
              hide-details
              @keydown.enter.exact.prevent="sendMessage"
            />
          </v-col>
          <v-col cols="auto" class="ml-2 d-flex flex-row align-end" style="gap: 4px;">
            <v-btn
              icon="mdi-attachment"
              variant="text"
              size="small"
              @click="$refs.fileInput.click()"
            />
            <v-btn
              icon="mdi-send"
              color="primary"
              size="small"
              :disabled="!inputMessage.trim() || chatStore.streaming"
              @click="sendMessage"
            />
          </v-col>
        </v-row>
        <input ref="fileInput" type="file" style="display:none" @change="handleFileAttach" />
      </v-sheet>
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
const selectedModelId = ref(null)
const chatTitle = ref('')
const messagesContainer = ref(null)
const fileInput = ref(null)

const modelItems = computed(() => [
  { name: '(None)', id: null },
  ...modelsStore.aiModels.filter(m => m.enabled !== false).map(m => ({ name: m.name, id: m.id }))
])

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

async function updateChatTitle() {
  if (currentChat.value && chatTitle.value !== currentChat.value.title) {
    await chatStore.updateChat(chatStore.currentChatId, { title: chatTitle.value })
  }
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
  padding: 16px;
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
}

.chat-input {
  flex-shrink: 0;
  padding: 12px;
}
</style>
