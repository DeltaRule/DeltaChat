<template>
  <v-navigation-drawer
    v-model="drawerOpen"
    :rail="rail && !mobile"
    :temporary="mobile"
    :permanent="!mobile"
    :width="280"
    elevation="1"
    class="d-flex flex-column"
    style="overflow: hidden;"
  >
    <!-- ── Desktop header ─────────────────────────────────── -->
    <template v-if="!mobile">
      <!-- Collapsed: chevron-right to expand -->
      <div v-if="rail" class="d-flex flex-column align-center py-3" style="gap: 4px;">
        <v-avatar color="primary" size="28" rounded="sm" style="flex-shrink:0">
          <v-icon icon="mdi-delta" size="16" color="white" />
        </v-avatar>
        <v-btn
          icon="mdi-chevron-right"
          variant="text"
          size="small"
          aria-label="Expand sidebar"
          @click="$emit('toggle-rail')"
        />
      </div>
      <!-- Expanded: logo + text + collapse chevron -->
      <div v-else class="d-flex align-center px-3" style="min-height: 48px;">
        <v-avatar color="primary" size="26" rounded="sm" class="mr-2" style="flex-shrink:0">
          <v-icon icon="mdi-delta" size="15" color="white" />
        </v-avatar>
        <span class="text-body-2 font-weight-bold flex-grow-1">DeltaChat</span>
        <v-btn
          icon="mdi-chevron-left"
          variant="text"
          size="small"
          aria-label="Collapse sidebar"
          @click="$emit('toggle-rail')"
        />
      </div>
      <v-divider />
    </template>

    <!-- ── Mobile header ──────────────────────────────────── -->
    <template v-else>
      <div class="d-flex align-center px-3 py-3">
        <v-avatar color="primary" size="26" rounded="sm" class="mr-2" style="flex-shrink:0">
          <v-icon icon="mdi-delta" size="15" color="white" />
        </v-avatar>
        <span class="text-body-2 font-weight-bold">DeltaChat</span>
      </div>
      <v-divider />
    </template>

    <!-- ── Collapsed rail: + icon only ───────────────────── -->
    <v-list v-if="rail && !mobile" density="compact" nav class="mt-1">
      <v-tooltip text="New Chat" location="right">
        <template #activator="{ props: tipProps }">
          <v-list-item
            v-bind="tipProps"
            prepend-icon="mdi-plus"
            rounded="lg"
            @click="goToNewChat"
          />
        </template>
      </v-tooltip>
    </v-list>

    <!-- ── Expanded: full chat sidebar ───────────────────── -->
    <template v-else>
      <div class="pa-2 flex-shrink-0">
        <v-btn
          block
          color="primary"
          prepend-icon="mdi-plus"
          size="small"
          variant="flat"
          class="mb-2 new-chat-btn"
          rounded="lg"
          @click="goToNewChat"
        >
          New Chat
        </v-btn>
        <v-text-field
          v-model="search"
          placeholder="Search chats…"
          density="compact"
          hide-details
          prepend-inner-icon="mdi-magnify"
          variant="solo-filled"
          flat
          clearable
          rounded="lg"
          class="search-field"
        />
      </div>

      <v-btn-toggle
        v-model="chatFilter"
        mandatory
        density="compact"
        class="mx-2 mb-1 flex-shrink-0 filter-toggle"
        style="width: calc(100% - 16px);"
        rounded="lg"
        color="primary"
      >
        <v-btn value="all" size="x-small" class="flex-1" rounded="lg">All</v-btn>
        <v-btn value="bookmarked" size="x-small" class="flex-1" rounded="lg">
          <v-icon size="14" class="mr-1">mdi-bookmark</v-icon>Saved
        </v-btn>
      </v-btn-toggle>

      <v-list class="sidebar-chat-list" density="compact">
        <!-- All chats view -->
        <template v-if="chatFilter === 'all'">
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
              <v-icon
                :icon="chat.bookmarked ? 'mdi-bookmark' : 'mdi-chat-outline'"
                size="16"
                class="mr-1"
              />
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

          <v-list-group v-for="folder in folders" :key="folder" :value="folder">
            <template #activator="{ props: gProps }">
              <v-list-item
                v-bind="gProps"
                :title="folder"
                prepend-icon="mdi-folder"
                rounded="lg"
                class="mb-1"
              />
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
                <v-btn
                  icon="mdi-delete"
                  size="x-small"
                  variant="text"
                  color="error"
                  @click.stop="chatStore.deleteChat(chat.id)"
                />
              </template>
            </v-list-item>
          </v-list-group>

          <v-list-item v-if="filteredChats.length === 0">
            <v-list-item-subtitle class="text-center pa-4">No chats yet</v-list-item-subtitle>
          </v-list-item>
        </template>

        <!-- Bookmarked view -->
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
              <v-btn
                icon="mdi-bookmark"
                size="x-small"
                variant="text"
                color="primary"
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
          <v-list-item v-if="bookmarkedChats.length === 0">
            <v-list-item-subtitle class="text-center pa-4">No saved chats</v-list-item-subtitle>
          </v-list-item>
        </template>
      </v-list>
    </template>
  </v-navigation-drawer>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'
import { useDisplay } from 'vuetify'
import { useRouter } from 'vue-router'
import { useChatStore } from '../stores/chat'

const props = defineProps({
  modelValue: { type: Boolean, default: true },
  rail: { type: Boolean, default: true }
})

const emit = defineEmits(['update:modelValue', 'toggle-rail'])

const { mobile } = useDisplay()
const router = useRouter()
const chatStore = useChatStore()

const drawerOpen = computed({
  get: () => props.modelValue,
  set: (val) => emit('update:modelValue', val)
})

const search = ref('')
const chatFilter = ref('all')

const filteredChats = computed(() =>
  chatStore.chats.filter(c =>
    (c.title || '').toLowerCase().includes(search.value.toLowerCase())
  )
)
const ungroupedChats = computed(() => filteredChats.value.filter(c => !c.folder))
const bookmarkedChats = computed(() => filteredChats.value.filter(c => c.bookmarked))
const folders = computed(() => [
  ...new Set(filteredChats.value.filter(c => c.folder).map(c => c.folder))
])
const chatsByFolder = computed(() => {
  const map = {}
  filteredChats.value.filter(c => c.folder).forEach(c => {
    if (!map[c.folder]) map[c.folder] = []
    map[c.folder].push(c)
  })
  return map
})

function goToNewChat() {
  chatStore.currentChatId = null
  if (router.currentRoute.value.path !== '/') router.push('/')
  if (mobile.value) emit('update:modelValue', false)
}

async function selectChat(id) {
  chatStore.currentChatId = id
  await chatStore.loadMessages(id)
  router.push('/')
  if (mobile.value) emit('update:modelValue', false)
}

async function toggleBookmark(chat) {
  await chatStore.updateChat(chat.id, { bookmarked: !chat.bookmarked })
}

onMounted(async () => {
  await chatStore.loadChats()
})
</script>

<style scoped>
.sidebar-chat-list {
  overflow-y: auto;
  flex: 1;
}

.new-chat-btn {
  font-weight: 600;
  letter-spacing: 0.3px;
  box-shadow: 0 2px 8px rgba(124, 77, 255, 0.2);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
  color: #fff !important;
}

.new-chat-btn:hover {
  box-shadow: 0 4px 16px rgba(124, 77, 255, 0.35);
  transform: translateY(-1px);
}

.search-field :deep(.v-field) {
  border-radius: 12px;
  background: rgba(var(--v-theme-surface-variant), 0.4);
  transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1);
}

.search-field :deep(.v-field:focus-within) {
  background: rgba(var(--v-theme-surface-variant), 0.7);
  box-shadow: 0 2px 12px rgba(124, 77, 255, 0.08);
}

.filter-toggle {
  border-radius: 12px !important;
  overflow: hidden;
}

.filter-toggle .v-btn {
  text-transform: none;
  font-weight: 600;
  font-size: 0.75rem;
  letter-spacing: 0.2px;
}
</style>
