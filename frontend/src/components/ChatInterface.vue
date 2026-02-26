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

      <!-- Filter tabs: All / Bookmarked -->
      <v-btn-toggle v-model="chatFilter" mandatory density="compact" class="mx-2 my-1" style="width: calc(100% - 16px);">
        <v-btn value="all" size="x-small" class="flex-1">All</v-btn>
        <v-btn value="bookmarked" size="x-small" class="flex-1">
          <v-icon size="14" class="mr-1">mdi-bookmark</v-icon>Saved
        </v-btn>
      </v-btn-toggle>

      <v-list class="chat-list" density="compact">
        <!-- Folder groups -->
        <template v-if="chatFilter === 'all'">
          <!-- Ungrouped chats -->
          <v-list-item
            v-for="chat in ungroupedChats"
            :key="chat.id"
            :active="chat.id === chatStore.currentChatId"
            :title="chat.title || 'New Chat'"
            rounded="lg"
            class="mb-1"
            @click="selectChat(chat.id)"
          >
            <template #prepend>
              <v-icon :icon="chat.bookmarked ? 'mdi-bookmark' : 'mdi-chat-outline'" size="16" class="mr-1" />
            </template>
            <template #append>
              <v-btn
                :icon="chat.bookmarked ? 'mdi-bookmark' : 'mdi-bookmark-outline'"
                size="x-small"
                variant="text"
                :color="chat.bookmarked ? 'primary' : undefined"
                @click.stop="toggleBookmark(chat)"
              />
              <v-btn
                icon="mdi-delete"
                size="x-small"
                variant="text"
                color="error"
                @click.stop="chatStore.deleteChat(chat.id)"
              />
            </template>
          </v-list-item>

          <!-- Folders -->
          <v-list-group v-for="folder in folders" :key="folder" :value="folder">
            <template #activator="{ props: gProps }">
              <v-list-item v-bind="gProps" :title="folder" prepend-icon="mdi-folder" rounded="lg" class="mb-1" />
            </template>
            <v-list-item
              v-for="chat in chatsByFolder[folder]"
              :key="chat.id"
              :active="chat.id === chatStore.currentChatId"
              :title="chat.title || 'New Chat'"
              rounded="lg"
              class="mb-1 ml-2"
              @click="selectChat(chat.id)"
            >
              <template #prepend>
                <v-icon icon="mdi-chat-outline" size="16" class="mr-1" />
              </template>
              <template #append>
                <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click.stop="chatStore.deleteChat(chat.id)" />
              </template>
            </v-list-item>
          </v-list-group>
        </template>

        <!-- Bookmarked only -->
        <template v-else>
          <v-list-item
            v-for="chat in bookmarkedChats"
            :key="chat.id"
            :active="chat.id === chatStore.currentChatId"
            :title="chat.title || 'New Chat'"
            rounded="lg"
            class="mb-1"
            @click="selectChat(chat.id)"
          >
            <template #prepend>
              <v-icon icon="mdi-bookmark" size="16" color="primary" class="mr-1" />
            </template>
            <template #append>
              <v-btn icon="mdi-bookmark" size="x-small" variant="text" color="primary" @click.stop="toggleBookmark(chat)" />
              <v-btn icon="mdi-delete" size="x-small" variant="text" color="error" @click.stop="chatStore.deleteChat(chat.id)" />
            </template>
          </v-list-item>
          <v-list-item v-if="bookmarkedChats.length === 0">
            <v-list-item-subtitle class="text-center pa-4">No saved chats</v-list-item-subtitle>
          </v-list-item>
        </template>

        <v-list-item v-if="chatFilter === 'all' && filteredChats.length === 0">
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
          <span v-else class="text-body-2 text-disabled">New Conversation</span>
        </v-toolbar-title>
        <v-spacer />
        <!-- Named model selector (desktop) — always visible -->
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
        <!-- Welcome greeting when no chat is active and no messages -->
        <div
          v-else-if="!chatStore.currentChatId"
          class="welcome-screen"
        >
          <v-avatar color="primary" size="72" rounded="lg" class="mb-5">
            <v-icon icon="mdi-delta" size="44" color="white" />
          </v-avatar>
          <h1 class="text-h5 font-weight-bold mb-2">Welcome to DeltaChat</h1>
          <p class="text-body-2 text-disabled">
            Type a message below to start a new conversation.
          </p>
        </div>
        <!-- Empty chat: has a chat selected but no messages -->
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
    <v-dialog v-model="showNewChat" max-width="420">
      <v-card>
        <v-card-title class="pt-4">New Chat</v-card-title>
        <v-card-text>
          <v-text-field
            v-model="newChatName"
            label="Chat Name (optional)"
            variant="outlined"
            class="mb-3"
            autofocus
            placeholder="Will be auto-named from first message"
          />
          <v-select
            v-model="newChatModelId"
            :items="modelItems"
            item-title="name"
            item-value="id"
            label="Model"
            variant="outlined"
            hint="Select a configured model or agent"
            persistent-hint
          />
          <v-text-field
            v-model="newChatFolder"
            label="Folder (optional)"
            variant="outlined"
            class="mt-3"
            placeholder="e.g. Work, Personal"
            prepend-inner-icon="mdi-folder"
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
import { useModelsStore } from '../stores/models'
import ChatMessage from './ChatMessage.vue'

const chatStore = useChatStore()
const modelsStore = useModelsStore()
const { mobile } = useDisplay()

const search = ref('')
const inputMessage = ref('')
const showNewChat = ref(false)
const newChatName = ref('')
const newChatModelId = ref(null)
const newChatFolder = ref('')
const selectedModelId = ref(null)
const chatTitle = ref('')
const messagesContainer = ref(null)
const fileInput = ref(null)
const sidebarOpen = ref(true)
const chatFilter = ref('all')

// Chat filter + grouping
const filteredChats = computed(() =>
  chatStore.chats.filter(c => (c.title || '').toLowerCase().includes(search.value.toLowerCase()))
)
const ungroupedChats = computed(() => filteredChats.value.filter(c => !c.folder))
const bookmarkedChats = computed(() => filteredChats.value.filter(c => c.bookmarked))
const folders = computed(() => [...new Set(filteredChats.value.filter(c => c.folder).map(c => c.folder))])
const chatsByFolder = computed(() => {
  const map = {}
  filteredChats.value.filter(c => c.folder).forEach(c => {
    if (!map[c.folder]) map[c.folder] = []
    map[c.folder].push(c)
  })
  return map
})

// Model items for selector
const modelItems = computed(() => [
  { name: '(None)', id: null },
  ...modelsStore.aiModels.filter(m => m.enabled !== false).map(m => ({ name: m.name, id: m.id }))
])

const currentChat = computed(() => chatStore.chats.find(c => c.id === chatStore.currentChatId))
const currentChatMessages = computed(() => chatStore.messages[chatStore.currentChatId] || [])

watch(() => currentChat.value, (chat) => {
  if (chat) {
    chatTitle.value = chat.title || ''
    selectedModelId.value = chat.modelId || null
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
  const chat = await chatStore.createChat(newChatName.value || '', newChatModelId.value, newChatFolder.value)
  chatStore.currentChatId = chat.id
  showNewChat.value = false
  newChatName.value = ''
  newChatFolder.value = ''
  if (mobile.value) sidebarOpen.value = false
}

async function sendMessage() {
  if (!inputMessage.value.trim() || chatStore.streaming) return
  const content = inputMessage.value.trim()
  inputMessage.value = ''

  // If no chat is selected, auto-create one first
  let chatId = chatStore.currentChatId
  if (!chatId) {
    const chat = await chatStore.createChat('', selectedModelId.value, null)
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

async function toggleBookmark(chat) {
  await chatStore.updateChat(chat.id, { bookmarked: !chat.bookmarked })
}

function handleFileAttach(e) {
  const file = e.target.files[0]
  if (file) inputMessage.value += ` [Attached: ${file.name}]`
}

onMounted(async () => {
  await chatStore.loadChats()
  await modelsStore.loadModels()
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
