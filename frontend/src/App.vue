<template>
  <v-app :theme="theme">
    <AppNavigation @toggle-theme="toggleTheme" />
    <v-main>
      <router-view />
    </v-main>
  </v-app>
</template>

<script setup>
import { ref } from 'vue'
import AppNavigation from './components/AppNavigation.vue'
const theme = ref('dark')
const toggleTheme = () => { theme.value = theme.value === 'dark' ? 'light' : 'dark' }
</script>
