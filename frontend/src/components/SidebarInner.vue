<template>
  <div class="flex flex-col flex-1 overflow-hidden">
    <!-- New chat + search -->
    <div class="p-2 space-y-2 shrink-0">
      <Button class="w-full shadow-md shadow-primary/20" size="sm" @click="goToNewChat">
        <Plus class="h-4 w-4 mr-2" />
        New Chat
      </Button>
      <div class="relative">
        <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
        <Input v-model="search" class="pl-8 h-9" placeholder="Search chats…" />
      </div>
    </div>

    <!-- Filter tabs -->
    <div class="flex mx-2 mb-1 rounded-md bg-muted p-0.5 shrink-0">
      <button
        :class="['flex-1 text-xs font-medium px-2 py-1 rounded-sm transition-colors', chatFilter === 'all' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground']"
        @click="chatFilter = 'all'"
      >All</button>
      <button
        :class="['flex-1 text-xs font-medium px-2 py-1 rounded-sm transition-colors flex items-center justify-center gap-1', chatFilter === 'bookmarked' ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground']"
        @click="chatFilter = 'bookmarked'"
      >
        <Bookmark class="h-3 w-3" />
        Saved
      </button>
    </div>

    <!-- Chat list -->
    <ScrollArea class="flex-1">
      <div class="p-1 space-y-0.5">
        <template v-if="chatFilter === 'all'">
          <div
            v-for="chat in ungroupedChats"
            :key="chat.id"
            :class="['flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors group', chat.id === chatStore.currentChatId ? 'bg-primary/10 text-primary border-l-2 border-primary' : 'hover:bg-accent text-foreground']"
            @click="selectChat(chat.id)"
          >
            <component :is="chat.bookmarked ? BookmarkCheck : MessageSquare" class="h-4 w-4 shrink-0 text-muted-foreground" />
            <span class="flex-1 truncate">{{ chat.title || 'New Chat' }}</span>
            <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon-xs" :class="chat.bookmarked ? 'text-primary' : ''" @click.stop="toggleBookmark(chat)">
                <component :is="chat.bookmarked ? BookmarkCheck : Bookmark" class="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon-xs" class="text-destructive" @click.stop="chatStore.deleteChat(chat.id)">
                <Trash2 class="h-3 w-3" />
              </Button>
            </div>
          </div>

          <details v-for="folder in folders" :key="folder" class="group/folder">
            <summary class="flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm hover:bg-accent text-muted-foreground font-medium list-none">
              <FolderIcon class="h-4 w-4" />
              <span>{{ folder }}</span>
            </summary>
            <div class="ml-3 space-y-0.5">
              <div
                v-for="chat in chatsByFolder[folder]"
                :key="chat.id"
                :class="['flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors group', chat.id === chatStore.currentChatId ? 'bg-primary/10 text-primary' : 'hover:bg-accent text-foreground']"
                @click="selectChat(chat.id)"
              >
                <MessageSquare class="h-4 w-4 shrink-0 text-muted-foreground" />
                <span class="flex-1 truncate">{{ chat.title || 'New Chat' }}</span>
                <Button variant="ghost" size="icon-xs" class="text-destructive opacity-0 group-hover:opacity-100" @click.stop="chatStore.deleteChat(chat.id)">
                  <Trash2 class="h-3 w-3" />
                </Button>
              </div>
            </div>
          </details>

          <p v-if="filteredChats.length === 0" class="text-center text-muted-foreground text-sm py-8">
            No chats yet
          </p>
        </template>

        <template v-else>
          <div
            v-for="chat in bookmarkedChats"
            :key="chat.id"
            :class="['flex items-center gap-2 px-2 py-1.5 rounded-md cursor-pointer text-sm transition-colors group', chat.id === chatStore.currentChatId ? 'bg-primary/10 text-primary' : 'hover:bg-accent text-foreground']"
            @click="selectChat(chat.id)"
          >
            <BookmarkCheck class="h-4 w-4 shrink-0 text-primary" />
            <span class="flex-1 truncate">{{ chat.title || 'New Chat' }}</span>
            <div class="flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button variant="ghost" size="icon-xs" class="text-primary" @click.stop="toggleBookmark(chat)">
                <BookmarkCheck class="h-3 w-3" />
              </Button>
              <Button variant="ghost" size="icon-xs" class="text-destructive" @click.stop="chatStore.deleteChat(chat.id)">
                <Trash2 class="h-3 w-3" />
              </Button>
            </div>
          </div>
          <p v-if="bookmarkedChats.length === 0" class="text-center text-muted-foreground text-sm py-8">
            No saved chats
          </p>
        </template>
      </div>
    </ScrollArea>
  </div>
</template>

<script setup>
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '../stores/chat'
import { Button } from './ui/button'
import { ScrollArea } from './ui/scroll-area'
import { Input } from './ui/input'
import {
  Plus, Search, MessageSquare, Bookmark, BookmarkCheck,
  Trash2, Folder as FolderIcon
} from 'lucide-vue-next'

const router = useRouter()
const chatStore = useChatStore()

const search = ref('')
const chatFilter = ref('all')

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

function goToNewChat() {
  chatStore.currentChatId = null
  if (router.currentRoute.value.path !== '/') router.push('/')
}

async function selectChat(id) {
  chatStore.currentChatId = id
  await chatStore.loadMessages(id)
  router.push('/')
}

async function toggleBookmark(chat) {
  await chatStore.updateChat(chat.id, { bookmarked: !chat.bookmarked })
}
</script>
