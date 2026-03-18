<template>
  <Sidebar collapsible="icon">
    <SidebarContent class="pt-2">
      <SidebarGroup>
        <SidebarGroupContent>
          <!-- New Chat button -->
          <SidebarMenu v-if="isCollapsed">
            <SidebarMenuItem>
              <SidebarMenuButton tooltip="New Chat" @click="goToNewChat">
                <Plus class="h-4 w-4" />
                <span>New Chat</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
          <template v-else>
            <Button class="w-full shadow-md shadow-primary/20" size="sm" @click="goToNewChat">
              <Plus class="h-4 w-4 mr-2" />
              New Chat
            </Button>

            <!-- Search -->
            <div class="relative mt-2">
              <Search class="absolute left-2.5 top-2.5 h-4 w-4 text-sidebar-foreground/50" />
              <Input
                v-model="search"
                class="pl-8 h-9 bg-sidebar-accent border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/50"
                placeholder="Search chats…"
              />
            </div>

            <!-- Filter tabs -->
            <ToggleGroup
              type="single"
              :model-value="chatFilter"
              class="mt-2 w-full rounded-md bg-sidebar-accent/50 p-0.5"
              variant="outline"
              size="sm"
              @update:model-value="
                (v) => {
                  if (v) chatFilter = v
                }
              "
            >
              <ToggleGroupItem
                value="all"
                class="flex-1 text-xs font-medium data-[state=on]:bg-sidebar-accent data-[state=on]:shadow-sm data-[state=on]:text-sidebar-foreground text-sidebar-foreground/60 hover:text-sidebar-foreground border-0"
              >
                All
              </ToggleGroupItem>
              <ToggleGroupItem
                value="bookmarked"
                class="flex-1 text-xs font-medium data-[state=on]:bg-sidebar-accent data-[state=on]:shadow-sm data-[state=on]:text-sidebar-foreground text-sidebar-foreground/60 hover:text-sidebar-foreground border-0 gap-1"
              >
                <Bookmark class="h-3 w-3" />
                Saved
              </ToggleGroupItem>
            </ToggleGroup>
          </template>
        </SidebarGroupContent>
      </SidebarGroup>

      <!-- Chat list -->
      <SidebarGroup class="flex-1 overflow-y-auto">
        <SidebarGroupContent>
          <SidebarMenu>
            <template v-if="chatFilter === 'all'">
              <SidebarMenuItem v-for="chat in ungroupedChats" :key="chat.id">
                <SidebarMenuButton
                  :is-active="chat.id === chatStore.currentChatId"
                  @click="selectChat(chat.id)"
                >
                  <component
                    :is="chat.bookmarked ? BookmarkCheck : MessageSquare"
                    class="h-4 w-4 shrink-0"
                  />
                  <span>{{ chat.title || 'New Chat' }}</span>
                </SidebarMenuButton>
                <SidebarMenuAction
                  :show-on-hover="true"
                  class="flex items-center gap-0.5 right-1 top-1/2 -translate-y-1/2 w-auto !aspect-auto"
                >
                  <button
                    :class="[
                      'p-0.5 rounded hover:bg-sidebar-accent',
                      chat.bookmarked ? 'text-primary' : '',
                    ]"
                    :aria-label="chat.bookmarked ? 'Remove bookmark' : 'Bookmark chat'"
                    @click.stop="toggleBookmark(chat)"
                  >
                    <component :is="chat.bookmarked ? BookmarkCheck : Bookmark" class="h-3 w-3" />
                  </button>
                  <button
                    class="p-0.5 rounded hover:bg-sidebar-accent text-destructive"
                    aria-label="Delete chat"
                    @click.stop="chatStore.deleteChat(chat.id)"
                  >
                    <Trash2 class="h-3 w-3" />
                  </button>
                </SidebarMenuAction>
              </SidebarMenuItem>

              <!-- Folder groups -->
              <template v-for="folder in folders" :key="folder">
                <SidebarMenuItem>
                  <Collapsible class="group/collapsible w-full">
                    <CollapsibleTrigger as-child>
                      <SidebarMenuButton>
                        <FolderIcon class="h-4 w-4" />
                        <span>{{ folder }}</span>
                      </SidebarMenuButton>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        <SidebarMenuSubItem v-for="chat in chatsByFolder[folder]" :key="chat.id">
                          <SidebarMenuSubButton
                            :is-active="chat.id === chatStore.currentChatId"
                            as="button"
                            @click="selectChat(chat.id)"
                          >
                            <MessageSquare class="h-4 w-4 shrink-0" />
                            <span>{{ chat.title || 'New Chat' }}</span>
                          </SidebarMenuSubButton>
                        </SidebarMenuSubItem>
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </Collapsible>
                </SidebarMenuItem>
              </template>

              <div
                v-if="filteredChats.length === 0"
                class="text-center text-muted-foreground text-sm py-8 px-2"
              >
                No chats yet
              </div>
            </template>

            <template v-else>
              <SidebarMenuItem v-for="chat in bookmarkedChats" :key="chat.id">
                <SidebarMenuButton
                  :is-active="chat.id === chatStore.currentChatId"
                  @click="selectChat(chat.id)"
                >
                  <BookmarkCheck class="h-4 w-4 shrink-0 text-primary" />
                  <span>{{ chat.title || 'New Chat' }}</span>
                </SidebarMenuButton>
                <SidebarMenuAction
                  :show-on-hover="true"
                  class="flex items-center gap-0.5 right-1 top-1/2 -translate-y-1/2 w-auto !aspect-auto"
                >
                  <button
                    class="p-0.5 rounded hover:bg-sidebar-accent text-primary"
                    aria-label="Remove bookmark"
                    @click.stop="toggleBookmark(chat)"
                  >
                    <BookmarkCheck class="h-3 w-3" />
                  </button>
                  <button
                    class="p-0.5 rounded hover:bg-sidebar-accent text-destructive"
                    aria-label="Delete chat"
                    @click.stop="chatStore.deleteChat(chat.id)"
                  >
                    <Trash2 class="h-3 w-3" />
                  </button>
                </SidebarMenuAction>
              </SidebarMenuItem>
              <div
                v-if="bookmarkedChats.length === 0"
                class="text-center text-muted-foreground text-sm py-8 px-2"
              >
                No saved chats
              </div>
            </template>
          </SidebarMenu>
        </SidebarGroupContent>
      </SidebarGroup>
    </SidebarContent>

    <SidebarRail />
  </Sidebar>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useChatStore } from '../stores/chat'
import { useSidebar } from '../composables/useSidebar'
import type { Chat } from '../types'
import { Button } from './ui/button'
import { Input } from './ui/input'
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group'
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarMenuAction,
  SidebarMenuSub,
  SidebarMenuSubItem,
  SidebarMenuSubButton,
  SidebarRail,
} from './ui/sidebar'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible'
import {
  Plus,
  Search,
  MessageSquare,
  Bookmark,
  BookmarkCheck,
  Trash2,
  Folder as FolderIcon,
} from 'lucide-vue-next'

const router = useRouter()
const chatStore = useChatStore()
const { isMobile, setOpenMobile, state } = useSidebar()

const isCollapsed = computed(() => state.value === 'collapsed')

const search = ref('')
const chatFilter = ref('all')

const filteredChats = computed(() =>
  chatStore.chats.filter((c) => (c.title || '').toLowerCase().includes(search.value.toLowerCase())),
)
const ungroupedChats = computed(() => filteredChats.value.filter((c) => !c.folder))
const bookmarkedChats = computed(() => filteredChats.value.filter((c) => c.bookmarked))
const folders = computed(() => [
  ...new Set(filteredChats.value.filter((c) => c.folder).map((c) => c.folder!)),
])
const chatsByFolder = computed(() => {
  const map: Record<string, Chat[]> = {}
  filteredChats.value
    .filter((c) => c.folder)
    .forEach((c) => {
      const folder = c.folder!
      if (!map[folder]) map[folder] = []
      map[folder].push(c)
    })
  return map
})

function goToNewChat() {
  chatStore.currentChatId = null
  if (router.currentRoute.value.path !== '/') router.push('/')
  if (isMobile.value) setOpenMobile(false)
}

async function selectChat(id: string) {
  chatStore.currentChatId = id
  await chatStore.loadMessages(id)
  router.push('/')
  if (isMobile.value) setOpenMobile(false)
}

async function toggleBookmark(chat: Chat) {
  await chatStore.updateChat(chat.id, { bookmarked: !chat.bookmarked })
}

onMounted(() => chatStore.loadChats())
</script>
