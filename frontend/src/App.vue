<template>
  <div class="h-screen flex flex-col overflow-hidden bg-background text-foreground">
    <TooltipProvider :delay-duration="0">
      <!-- Persistent header — never animates -->
      <header class="sticky top-0 z-50 flex h-12 items-center border-b border-border bg-background/80 backdrop-blur-lg px-4 gap-3 shrink-0">
        <button
          class="-ml-1 flex h-8 w-8 items-center justify-center rounded-lg hover:bg-accent transition-colors"
          @click="isSettings ? router.push('/') : sidebarToggleFn?.()"
        >
          <div class="flex h-6 w-6 items-center justify-center rounded-md bg-primary text-primary-foreground shadow-sm">
            <Triangle class="h-3.5 w-3.5" />
          </div>
        </button>

        <div class="flex-1" />

        <Tooltip>
          <TooltipTrigger as-child>
            <div :class="['h-2 w-2 rounded-full cursor-default', connected ? 'bg-green-500' : 'bg-red-500']" />
          </TooltipTrigger>
          <TooltipContent>{{ connected ? 'Connected' : 'Disconnected' }}</TooltipContent>
        </Tooltip>

        <Button variant="ghost" size="icon-sm" @click="themeStore.toggleTheme">
          <Sun v-if="themeStore.isDark" class="h-4 w-4" />
          <Moon v-else class="h-4 w-4" />
        </Button>

        <Button :variant="isSettings ? 'secondary' : 'ghost'" size="icon-sm" @click="toggleSettings">
          <Settings class="h-4 w-4" />
        </Button>
      </header>

      <!-- Content area -->
      <div class="flex-1 min-h-0 overflow-hidden relative">
        <!-- Chat view -->
        <div v-if="!isSettings" class="h-full">
          <SidebarProvider class="min-h-0 h-full" v-slot="{ toggle }">
            <SidebarToggleCapture :toggle="toggle" />
            <AppNavigation />
            <SidebarInset class="min-h-0">
              <router-view />
            </SidebarInset>
          </SidebarProvider>
        </div>

        <!-- Settings view -->
        <div v-else class="h-full overflow-hidden">
          <router-view />
        </div>
      </div>
    </TooltipProvider>

    <Toaster :theme="themeStore.isDark ? 'dark' : 'light'" position="bottom-right" rich-colors />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted, defineComponent, h, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Toaster } from 'vue-sonner'
import { Sun, Moon, Settings, Triangle } from 'lucide-vue-next'
import AppNavigation from './components/AppNavigation.vue'
import { Button } from './components/ui/button'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from './components/ui/tooltip'
import { SidebarProvider, SidebarInset } from './components/ui/sidebar'
import { useThemeStore } from './stores/theme'
import { useNotificationStore } from './stores/notification'
import axios from 'axios'

const route = useRoute()
const router = useRouter()
const themeStore = useThemeStore()
const notify = useNotificationStore()

const connected = ref(false)
const sidebarToggleFn = ref(null)

// Invisible component to capture sidebar toggle function from scoped slot
const SidebarToggleCapture = defineComponent({
  props: { toggle: Function },
  setup(props) {
    watch(() => props.toggle, (fn) => { sidebarToggleFn.value = fn }, { immediate: true })
    return () => null
  }
})

const isSettings = computed(() => route.path.startsWith('/settings'))
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
let interval

function toggleSettings() {
  if (isSettings.value) router.push('/')
  else router.push('/settings')
}

async function checkConnection() {
  try {
    await axios.get(`${API}/health`, { timeout: 3000 })
    connected.value = true
  } catch {
    connected.value = false
  }
}

onMounted(() => {
  checkConnection()
  interval = setInterval(checkConnection, 10000)
})
onUnmounted(() => {
  clearInterval(interval)
})
</script>
