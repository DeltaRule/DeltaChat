<template>
  <v-app-bar color="primary" elevation="2">
    <v-app-bar-title>
      <v-icon icon="mdi-delta" class="mr-2" />
      DeltaChat
    </v-app-bar-title>
    <v-btn :to="'/'" variant="text" prepend-icon="mdi-chat">Chat</v-btn>
    <v-btn :to="'/knowledge'" variant="text" prepend-icon="mdi-database">Knowledge</v-btn>
    <v-btn :to="'/settings'" variant="text" prepend-icon="mdi-cog">Settings</v-btn>
    <v-spacer />
    <v-tooltip :text="connected ? 'Connected' : 'Disconnected'">
      <template #activator="{ props }">
        <v-icon v-bind="props" :color="connected ? 'success' : 'error'" icon="mdi-circle" size="small" class="mr-2" />
      </template>
    </v-tooltip>
    <v-btn :icon="isDark ? 'mdi-weather-sunny' : 'mdi-weather-night'" variant="text" @click="$emit('toggle-theme')" />
  </v-app-bar>
</template>

<script setup>
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useTheme } from 'vuetify'
import axios from 'axios'

defineEmits(['toggle-theme'])
const theme = useTheme()
const isDark = computed(() => theme.global.name.value === 'dark')
const connected = ref(false)

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000'
let interval

async function checkConnection() {
  try {
    await axios.get(`${API}/api/health`, { timeout: 3000 })
    connected.value = true
  } catch {
    connected.value = false
  }
}

onMounted(() => { checkConnection(); interval = setInterval(checkConnection, 10000) })
onUnmounted(() => clearInterval(interval))
</script>
