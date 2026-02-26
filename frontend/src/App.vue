<template>
  <v-app :theme="theme">
    <AppNavigation
      v-if="!isSettings"
      v-model="drawer"
      :rail="rail"
      @toggle-rail="rail = !rail"
    />

    <v-app-bar elevation="2" density="compact">
      <v-app-bar-nav-icon v-if="!isSettings" @click="toggleDrawer" />
      <!-- Only show brand in app bar when sidebar is collapsed or on mobile -->
      <v-app-bar-title v-if="isSettings || rail || mobile" class="font-weight-bold text-body-1">
        <v-avatar color="primary" size="26" rounded="sm" class="mr-2" style="flex-shrink:0">
          <v-icon icon="mdi-delta" size="15" color="white" />
        </v-avatar>
        DeltaChat
      </v-app-bar-title>
      <v-spacer />
      <v-tooltip :text="connected ? 'Connected' : 'Disconnected'" location="bottom">
        <template #activator="{ props: tipProps }">
          <v-icon
            v-bind="tipProps"
            :color="connected ? 'success' : 'error'"
            icon="mdi-circle"
            size="x-small"
            class="mr-2"
          />
        </template>
      </v-tooltip>
      <v-btn
        :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'"
        variant="text"
        density="compact"
        @click="toggleTheme"
      />
      <v-btn
        icon="mdi-cog"
        variant="text"
        density="compact"
        :to="'/settings'"
        class="mr-1"
      />
    </v-app-bar>

    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useDisplay } from 'vuetify'
import { useRoute } from 'vue-router'
import AppNavigation from './components/AppNavigation.vue'
import axios from 'axios'

const { mobile } = useDisplay()
const route = useRoute()

const theme = ref('dark')
const drawer = ref(true)
const rail = ref(true)
const connected = ref(false)

const isDark = computed(() => theme.value === 'dark')
const isSettings = computed(() => route.path.startsWith('/settings'))
const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
let interval

function toggleTheme() {
  theme.value = theme.value === 'dark' ? 'light' : 'dark'
}

function toggleDrawer() {
  if (mobile.value) {
    drawer.value = !drawer.value
  } else {
    rail.value = !rail.value
  }
}

async function checkConnection() {
  try {
    await axios.get(`${API}/api/health`, { timeout: 3000 })
    connected.value = true
  } catch {
    connected.value = false
  }
}

onMounted(() => {
  if (mobile.value) drawer.value = false
  checkConnection()
  interval = setInterval(checkConnection, 10000)
})
onUnmounted(() => clearInterval(interval))
</script>
