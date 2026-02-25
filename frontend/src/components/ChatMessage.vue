<template>
  <div :class="['d-flex', 'mb-3', isUser ? 'justify-end' : 'justify-start']">
    <v-avatar v-if="!isUser" color="primary" size="32" class="mr-2 mt-1">
      <v-icon icon="mdi-robot" size="20" />
    </v-avatar>
    <v-card
      :color="isUser ? 'primary' : 'surface'"
      :variant="isUser ? 'flat' : 'outlined'"
      max-width="75%"
      class="pa-3"
      rounded="lg"
    >
      <div v-if="isUser" class="text-body-2">{{ message.content }}</div>
      <div v-else class="text-body-2 markdown-body" v-html="renderedContent" />
      <div class="text-caption text-disabled mt-1">{{ formattedTime }}</div>
    </v-card>
    <v-avatar v-if="isUser" color="secondary" size="32" class="ml-2 mt-1">
      <v-icon icon="mdi-account" size="20" />
    </v-avatar>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { marked } from 'marked'

const props = defineProps({ message: Object })
const isUser = computed(() => props.message.role === 'user')
const renderedContent = computed(() => {
  try { return marked.parse(props.message.content || '') } catch { return props.message.content }
})
const formattedTime = computed(() => {
  if (!props.message.createdAt && !props.message.id) return ''
  const d = new Date(props.message.createdAt || props.message.id)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
})
</script>

<style>
.markdown-body p { margin-bottom: 8px; }
.markdown-body p:last-child { margin-bottom: 0; }
.markdown-body pre { background: rgba(0,0,0,0.2); padding: 12px; border-radius: 6px; overflow-x: auto; }
.markdown-body code { font-family: monospace; font-size: 0.85em; }
.markdown-body ul, .markdown-body ol { padding-left: 20px; }
</style>
