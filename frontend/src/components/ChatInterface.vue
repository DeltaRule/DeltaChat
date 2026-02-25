<template>
  <v-container fluid class="pa-0 fill-height">
    <v-row no-gutters class="fill-height">
      <!-- Sidebar -->
      <v-col cols="12" md="3" class="border-e" style="max-height: calc(100vh - 64px); display: flex; flex-direction: column;">
        <v-sheet class="pa-2">
          <v-btn block color="primary" prepend-icon="mdi-plus" @click="showNewChat = true" class="mb-2">
            New Chat
          </v-btn>
          <v-text-field v-model="search" placeholder="Search chats..." density="compact" hide-details prepend-inner-icon="mdi-magnify" variant="outlined" />
        </v-sheet>
        <v-list style="overflow-y: auto; flex: 1;" density="compact">
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
              <v-btn icon="mdi-delete" size="x-small" variant="text" @click.stop="chatStore.deleteChat(chat.id)" />
            </template>
          </v-list-item>
          <v-list-item v-if="filteredChats.length === 0" subtitle="No chats yet" />
        </v-list>
      </v-col>

      <!-- Main Chat Area -->
      <v-col cols="12" md="9" style="display: flex; flex-direction: column; max-height: calc(100vh - 64px);">
        <!-- Chat toolbar -->
        <v-toolbar density="compact" color="surface" border="b">
          <v-toolbar-title>
            <v-text-field
              v-if="currentChat"
              v-model="chatTitle"
              variant="plain"
              hide-details
              density="compact"
              @blur="updateChatTitle"
              style="max-width: 200px"
            />
            <span v-else>Select a chat</span>
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
            style="max-width: 200px"
            class="mr-2"
          />
          <v-select
            v-model="selectedKnowledgeStore"
            :items="knowledgeItems"
            density="compact"
            hide-details
            variant="outlined"
            label="Knowledge"
            style="max-width: 180px"
            class="mr-2"
          />
        </v-toolbar>

        <!-- Messages -->
        <div ref="messagesContainer" style="flex: 1; overflow-y: auto; padding: 16px;">
          <template v-if="currentChatMessages.length">
            <ChatMessage v-for="msg in currentChatMessages" :key="msg.id" :message="msg" />
            <div v-if="chatStore.streaming" class="d-flex align-center mb-3">
              <v-avatar color="primary" size="32" class="mr-2">
                <v-icon icon="mdi-robot" size="20" />
              </v-avatar>
              <v-card color="surface" variant="outlined" class="pa-3" rounded="lg">
                <v-progress-circular indeterminate size="16" width="2" color="primary" class="mr-2" />
                <span class="text-caption">Thinking...</span>
              </v-card>
            </div>
          </template>
          <div v-else class="d-flex align-center justify-center fill-height text-disabled" style="min-height: 200px;">
            <div class="text-center">
              <v-icon icon="mdi-chat-outline" size="64" class="mb-4" />
              <div class="text-h6">{{ chatStore.currentChatId ? 'No messages yet' : 'Select or create a chat' }}</div>
            </div>
          </div>
        </div>

        <!-- Input area -->
        <v-sheet class="pa-3" border="t" v-if="chatStore.currentChatId">
          <v-row no-gutters align="end">
            <v-col>
              <v-textarea
                v-model="inputMessage"
                placeholder="Type a message... (Enter to send, Shift+Enter for newline)"
                variant="outlined"
                rows="1"
                auto-grow
                max-rows="6"
                hide-details
                @keydown.enter.exact.prevent="sendMessage"
              />
            </v-col>
            <v-col cols="auto" class="ml-2 d-flex flex-column gap-1">
              <v-btn icon="mdi-attachment" variant="text" size="small" @click="$refs.fileInput.click()" />
              <v-btn icon="mdi-send" color="primary" size="small" @click="sendMessage" :disabled="!inputMessage.trim() || chatStore.streaming" />
            </v-col>
          </v-row>
          <input ref="fileInput" type="file" style="display:none" @change="handleFileAttach" />
        </v-sheet>
      </v-col>
    </v-row>

    <!-- New Chat Dialog -->
    <v-dialog v-model="showNewChat" max-width="400">
      <v-card>
        <v-card-title>New Chat</v-card-title>
        <v-card-text>
          <v-text-field v-model="newChatName" label="Chat Name" variant="outlined" class="mb-2" />
          <v-text-field v-model="newChatModel" label="Model (e.g. gpt-4o)" variant="outlined" />
        </v-card-text>
        <v-card-actions>
          <v-spacer />
          <v-btn @click="showNewChat = false">Cancel</v-btn>
          <v-btn color="primary" @click="createNewChat">Create</v-btn>
        </v-card-actions>
      </v-card>
    </v-dialog>
  </v-container>
</template>

<script setup>
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useChatStore } from '../stores/chat'
import { useKnowledgeStore } from '../stores/knowledge'
import ChatMessage from './ChatMessage.vue'

const chatStore = useChatStore()
const knowledgeStore = useKnowledgeStore()

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
  if (chat) { chatTitle.value = chat.name || ''; selectedModel.value = chat.model || 'gpt-4o' }
})

watch(currentChatMessages, async () => {
  await nextTick()
  if (messagesContainer.value) messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
}, { deep: true })

async function selectChat(id) {
  chatStore.currentChatId = id
  await chatStore.loadMessages(id)
}

async function createNewChat() {
  const chat = await chatStore.createChat(newChatName.value || 'New Chat', newChatModel.value)
  chatStore.currentChatId = chat.id
  showNewChat.value = false
  newChatName.value = ''
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
})
</script>
