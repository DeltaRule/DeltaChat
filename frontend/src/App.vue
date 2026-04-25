<template>
  <div class="h-screen flex flex-col overflow-hidden bg-background text-foreground">
    <!-- Login page – full-screen, no shell -->
    <template v-if="isLogin">
      <router-view />
      <Teleport to="body">
        <Toaster
          :theme="themeStore.isDark ? 'dark' : 'light'"
          position="bottom-right"
          rich-colors
        />
      </Teleport>
    </template>

    <!-- Authenticated app shell -->
    <template v-else>
      <TooltipProvider :delay-duration="0">
        <!-- Persistent header — never animates -->
        <header
          class="sticky top-0 z-50 flex h-12 items-center border-b border-border bg-background/80 backdrop-blur-lg px-4 gap-3 shrink-0"
        >
          <Button variant="ghost" size="icon-sm" class="-ml-1" @click="router.push('/')">
            <div
              class="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm"
            >
              <Triangle class="h-3.5 w-3.5" />
            </div>
          </Button>

          <div class="flex-1" />

          <Tooltip>
            <TooltipTrigger as-child>
              <div
                :class="[
                  'h-2 w-2 rounded-full cursor-default',
                  connected ? 'bg-green-500' : 'bg-red-500',
                ]"
              />
            </TooltipTrigger>
            <TooltipContent>{{ connected ? 'Connected' : 'Disconnected' }}</TooltipContent>
          </Tooltip>

          <Button variant="ghost" size="icon-sm" @click="themeStore.toggleTheme">
            <Sun v-if="themeStore.isDark" class="h-4 w-4" />
            <Moon v-else class="h-4 w-4" />
          </Button>

          <Button
            :variant="isSettings ? 'secondary' : 'ghost'"
            size="icon-sm"
            @click="toggleSettings"
          >
            <Settings class="h-4 w-4" />
          </Button>

          <Button
            v-if="authStore.isAdmin"
            :variant="isAdmin ? 'secondary' : 'ghost'"
            size="icon-sm"
            @click="isAdmin ? router.push('/') : router.push('/admin')"
          >
            <Shield class="h-4 w-4" />
          </Button>

          <!-- User menu -->
          <DropdownMenu v-if="authStore.isAuthenticated">
            <DropdownMenuTrigger as-child>
              <Button variant="ghost" size="icon-sm">
                <UserCircle class="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" class="w-48">
              <div class="px-2 py-1.5 text-sm">
                <div class="font-medium truncate">
                  {{ authStore.user?.name || authStore.user?.email }}
                </div>
                <div class="text-xs text-muted-foreground capitalize">
                  {{ authStore.user?.role }}
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem @click="handleLogout">
                <LogOut class="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        <!-- Content area -->
        <div class="flex-1 min-h-0 overflow-hidden relative">
          <Transition name="page" mode="out-in">
            <!-- Chat view -->
            <div v-if="!isSettings && !isAdmin" key="chat-content" class="h-full">
              <SidebarProvider class="min-h-0 h-full">
                <AppNavigation />
                <SidebarInset class="min-h-0">
                  <router-view />
                </SidebarInset>
              </SidebarProvider>
            </div>

            <!-- Settings / Admin view -->
            <div v-else key="settings-content" class="h-full overflow-hidden">
              <SidebarProvider class="min-h-0 h-full">
                <router-view />
              </SidebarProvider>
            </div>
          </Transition>
        </div>
      </TooltipProvider>

      <Teleport to="body">
        <Toaster
          :theme="themeStore.isDark ? 'dark' : 'light'"
          position="bottom-right"
          rich-colors
        />
      </Teleport>
    </template>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Toaster } from 'vue-sonner'
import { Sun, Moon, Settings, Triangle, Shield, UserCircle, LogOut } from 'lucide-vue-next'
import AppNavigation from './components/AppNavigation.vue'
import { Button } from './components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './components/ui/tooltip'
import { SidebarProvider, SidebarInset } from './components/ui/sidebar'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from './components/ui/dropdown-menu'
import { useThemeStore } from './stores/theme'
import { useAuthStore } from './stores/auth'
import { useChatStore } from './stores/chat'
import api, { API_URL } from './lib/api'

const route = useRoute()
const router = useRouter()
const themeStore = useThemeStore()
const authStore = useAuthStore()
const chatStore = useChatStore()

const connected = ref(false)

const isSettings = computed(() => route.path.startsWith('/settings'))
const isAdmin = computed(() => route.path.startsWith('/admin'))
const isLogin = computed(() => route.path === '/login')
let interval: ReturnType<typeof setInterval> | undefined

function toggleSettings() {
  if (isSettings.value) router.push('/')
  else router.push('/settings')
}

async function handleLogout() {
  chatStore.disconnectSocket()
  await authStore.logout()
  router.push('/login')
}

async function checkConnection() {
  try {
    await api.get('/health', { timeout: 3000, baseURL: API_URL })
    connected.value = true
  } catch {
    connected.value = false
  }
}

onMounted(async () => {
  authStore.loadFromStorage()
  // Silently try to restore session via refresh token cookie.
  // This re-hydrates the in-memory access token on page reload.
  if (!authStore.token) {
    await authStore.refreshAccessToken()
  }
  // Connect the socket now that the token is in memory
  if (authStore.isAuthenticated) {
    chatStore.reconnectSocket()
  }
  checkConnection()
  interval = setInterval(checkConnection, 10000)
})
onUnmounted(() => {
  clearInterval(interval)
})
</script>

<style scoped>
.page-enter-active,
.page-leave-active {
  transition:
    opacity 0.18s ease-out,
    transform 0.18s ease-out;
}
.page-enter-from {
  opacity: 0;
  transform: translateY(6px);
}
.page-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}
</style>
