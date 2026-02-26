<template>
  <div class="chat-layout">
    <!-- Sidebar: Chat list -->
    <aside class="chat-sidebar" :class="{ 'chat-sidebar--open': sidebarOpen }">
      <v-sheet class="pa-2 border-b" color="surface">
        <v-btn
          block
          color="primary"
          prepend-icon="mdi-plus"
          size="small"
          @click="showNewChat = true"
          class="mb-2"
        >
          New Chat
        </v-btn>
        <v-text-field
          v-model="search"
          placeholder="Search chats…"
          density="compact"
          hide-details
          prepend-inner-icon="mdi-magnify"
          variant="outlined"
          clearable
        />
      </v-sheet>

      <v-list class="chat-list" density="compact">
        <v-list-item
          v-for="chat in filteredChats"
          :key="chat.id"
          :active="chat.id === chatStore.currentChatId"
          :title="chat.name || 'Untitled Chat'"
          :subtitle="chat.model || chat.webhookUrl || ''"
          rounded="lg"
          class="mb-1"
          @click="selectChat(chat.id)"
        >
          <template #append>
            <v-btn
              icon="mdi-delete"
              size="x-small"
              variant="text"
              color="error"
              @click.stop="chatStore.deleteChat(chat.id)"
            />
          </template>
        </v-list-item>
        <v-list-item v-if="filteredChats.length === 0">
          <v-list-item-subtitle class="text-center pa-4">No chats yet</v-list-item-subtitle>
        </v-list-item>
      </v-list>
    </aside>

    <!-- Overlay for mobile sidebar -->
    <div
      v-if="mobile && sidebarOpen"
      class="chat-overlay"
      @click="sidebarOpen = false"
    />

    <!-- Main chat area -->
    <section class="chat-main">
      <!-- Chat toolbar -->
      <v-toolbar density="compact" color="surface" border="b" class="chat-toolbar">
        <!-- Mobile: toggle sidebar -->
        <v-btn
          v-if="mobile"
          icon="mdi-menu"
          variant="text"
          size="small"
          class="mr-1"
          @click="sidebarOpen = !sidebarOpen"
        />
        <v-toolbar-title>
          <v-text-field
            v-if="currentChat"
            v-model="chatTitle"
            variant="plain"
            hide-details
            density="compact"
            placeholder="Chat name…"
            @blur="updateChatTitle"
            style="max-width: 180px"
          />
          <span v-else class="text-body-2 text-disabled">Select or create a chat</span>
        </v-toolbar-title>
        <v-spacer />
        <v-select
          v-if="currentChat && !currentChat.webhookUrl"
          v-model="selectedModel"
          :items="availableModels"
          density="compact"
          hide-details
          variant="outlined"
          label="Model"
          style="max-width: 160px"
          class="mr-2 d-none d-sm-flex"
        />
        <v-select
          v-model="selectedKnowledgeStore"
          :items="knowledgeItems"
          density="compact"
          hide-details
          variant="outlined"
          label="Knowledge"
          style="max-width: 140px"
          class="mr-1 d-none d-sm-flex"
        />
      </v-toolbar>

      <!-- Messages -->
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
        <div
          v-else
          class="d-flex align-center justify-center text-disabled"
          style="height: 100%; min-height: 200px;"
        >
          <div class="text-center">
            <v-icon icon="mdi-chat-outline" size="64" class="mb-4 text-medium-emphasis" />
            <div class="text-h6 text-medium-emphasis">
              {{ chatStore.currentChatId ? 'No messages yet' : 'Select or create a chat' }}
            </div>
            <div v-if="!chatStore.currentChatId" class="text-body-2 text-disabled mt-2">
              Use the <strong>New Chat</strong> button to get started
            </div>
          </div>
        </div>
      </div>

      <!-- Input area -->
      <v-sheet v-if="chatStore.currentChatId" class="chat-input" border="t" color="surface">
        <!-- Mobile model/knowledge selectors -->
        <div v-if="mobile && currentChat" class="d-flex gap-2 mb-2">
          <v-select
            v-if="!currentChat.webhookUrl"
            v-model="selectedModel"
            :items="availableModels"
            density="compact"
            hide-details
            variant="outlined"
            label="Model"
            class="flex-1"
          />
          <v-select
            v-model="selectedKnowledgeStore"
            :items="knowledgeItems"
            density="compact"
            hide-details
            variant="outlined"
            label="Knowledge"
            class="flex-1"
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
          <v-col cols="auto" class="ml-2 d-flex flex-column" style="gap: 4px;">
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

    <!-- New Chat Dialog -->
    <v-dialog v-model="showNewChat" max-width="400">
      <v-card>
        <v-card-title class="pt-4">New Chat</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newChatName"
            label="Chat Name"
            variant="outlined"
            class="mb-3"
            autofocus
          />
          <v-select
            v-model="newChatModel"
            :items="availableModels"
            label="Model"
            variant="outlined"
          />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn variant="text" @click="showNewChat = false">Cancel</v-btn>
          <v-btn color="primary" @click="createNewChat">Create</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useDisplay } from 'vuetify'
import { useChatStore } from '../stores/chat'
import { useKnowledgeStore } from '../stores/knowledge'
import ChatMessage from './ChatMessage.vue'

const chatStore = useChatStore()
const knowledgeStore = useKnowledgeStore()
const { mobile } = useDisplay()

const search = ref('')
const inputMessage = ref('')
const showNewChat = ref(false)
const newChatName = ref('')
const newChatModel = ref('gpt-4o')
const selectedModel = ref('gpt-4o')
const selectedKnowledgeStore = ref(null)
const chatTitle = ref('')
const messagesContainer = ref(null)
const fileInput = ref(null)
const sidebarOpen = ref(true)

const availableModels = ['gpt-4o', 'gpt-4o-mini', 'gpt-3.5-turbo', 'claude-3-5-sonnet', 'llama3', 'mistral']

const filteredChats = computed(() =>
  chatStore.chats.filter(c => (c.name || '').toLowerCase().includes(search.value.toLowerCase()))
)
const currentChat = computed(() => chatStore.chats.find(c => c.id === chatStore.currentChatId))
const currentChatMessages = computed(() => chatStore.messages[chatStore.currentChatId] || [])
const knowledgeItems = computed(() => [
  { title: 'None', value: null },
  ...knowledgeStore.knowledgeStores.map(k => ({ title: k.name, value: k.id }))
])

watch(() => currentChat.value, (chat) => {
  if (chat) {
    chatTitle.value = chat.name || ''
    selectedModel.value = chat.model || 'gpt-4o'
  }
})

watch(currentChatMessages, async () => {
  await nextTick()
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}, { deep: true })

async function selectChat(id) {
  chatStore.currentChatId = id
  await chatStore.loadMessages(id)
  if (mobile.value) sidebarOpen.value = false
}

async function createNewChat() {
  const chat = await chatStore.createChat(newChatName.value || 'New Chat', newChatModel.value)
  chatStore.currentChatId = chat.id
  showNewChat.value = false
  newChatName.value = ''
  if (mobile.value) sidebarOpen.value = false
}

async function sendMessage() {
  if (!inputMessage.value.trim() || chatStore.streaming) return
  const content = inputMessage.value.trim()
  inputMessage.value = ''
  chatStore.streamMessage(chatStore.currentChatId, content, {
    model: selectedModel.value,
    knowledgeStoreId: selectedKnowledgeStore.value
  })
}

function updateChatTitle() {
  // Could call API to update chat name
}

function handleFileAttach(e) {
  const file = e.target.files[0]
  if (file) inputMessage.value += ` [Attached: ${file.name}]`
}

onMounted(async () => {
  await chatStore.loadChats()
  await knowledgeStore.loadKnowledgeStores()
  // Start collapsed on mobile
  if (mobile.value) sidebarOpen.value = false
})
</script>

<style scoped>
.chat-layout {
  --app-bar-height: 48px;
  display: flex;
  height: calc(100vh - var(--app-bar-height));
  overflow: hidden;
  position: relative;
}

/* Sidebar */
.chat-sidebar {
  width: 260px;
  min-width: 260px;
  display: flex;
  flex-direction: column;
  border-right: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  background: rgb(var(--v-theme-surface));
  overflow: hidden;
  transition: transform 0.25s ease;
}

.chat-list {
  overflow-y: auto;
  flex: 1;
}

/* Main area */
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
}

.chat-input {
  flex-shrink: 0;
  padding: 12px;
}

/* Mobile: sidebar becomes an overlay panel */
@media (max-width: 959px) {
  .chat-sidebar {
    position: absolute;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 10;
    transform: translateX(-100%);
  }

  .chat-sidebar--open {
    transform: translateX(0);
  }
}

/* Overlay backdrop on mobile */
.chat-overlay {
  position: absolute;
  inset: 0;
  background: rgba(0, 0, 0, 0.4);
  z-index: 9;
}
</style>
