<template>
  <div
    :class="[
      'flex mb-4 animate-[messageSlideIn_0.25s_ease-out] max-w-[800px] mx-auto w-full',
      isUser ? 'justify-end' : 'justify-start',
    ]"
  >
    <!-- Bot avatar -->
    <div
      v-if="!isUser"
      class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground mr-3 mt-1 shrink-0 shadow-md shadow-primary/30"
    >
      <Bot class="h-5 w-5" />
    </div>

    <!-- Message bubble -->
    <div
      :class="[
        'max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed relative',
        isUser
          ? 'bg-primary text-primary-foreground rounded-br-sm shadow-lg shadow-primary/25'
          : 'bg-muted border border-border rounded-bl-sm',
      ]"
    >
      <div v-if="isUser">
        <div
          v-if="attachmentNames.length"
          class="flex items-center gap-1.5 mb-1.5 text-xs opacity-80"
        >
          <Paperclip class="h-3 w-3" />
          <span v-for="name in attachmentNames" :key="name">{{ name }}</span>
        </div>
        <div v-if="displayContent" class="whitespace-pre-wrap">
          {{ displayContent }}
        </div>
      </div>
      <div v-else-if="isStreaming && !message.content" class="flex items-center gap-2">
        <Loader2 class="h-4 w-4 animate-spin text-primary" />
        <span class="text-xs text-muted-foreground">Thinking…</span>
      </div>
      <div v-else class="markdown-body" v-html="renderedContent" />

      <!-- Sources -->
      <div v-if="!isUser && uniqueSources.length" class="mt-2 pt-2 border-t border-border/50">
        <div class="text-[0.65rem] text-muted-foreground/80 font-medium mb-1">Sources</div>
        <div class="flex flex-wrap gap-1">
          <a
            v-for="(src, i) in uniqueSources"
            :key="src.docId || src.chunkId || i"
            href="#"
            class="inline-flex items-center gap-1 text-[0.6rem] px-1.5 py-0.5 rounded bg-primary/10 text-primary hover:bg-primary/20 cursor-pointer transition-colors no-underline"
            :title="src.text"
            @click.prevent="downloadSource(src)"
          >
            <FileText class="h-3 w-3 shrink-0" />
            [{{ i + 1 }}] {{ src.filename || 'Document' }}
          </a>
        </div>
      </div>

      <div
        :class="[
          'text-[0.65rem] mt-1',
          isUser ? 'text-primary-foreground/60' : 'text-muted-foreground/60',
        ]"
      >
        {{ formattedTime }}
      </div>
    </div>

    <!-- User avatar -->
    <div
      v-if="isUser"
      class="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground ml-3 mt-1 shrink-0 shadow-md"
    >
      <User class="h-5 w-5" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { marked } from 'marked'
import { Bot, User, Loader2, Paperclip, FileText } from 'lucide-vue-next'
import api from '@/lib/api'
import type { ChatMessage, MessageSource } from '@/types'

const apiBase = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const props = defineProps<{
  message: ChatMessage
  isStreaming?: boolean
}>()
const isUser = computed(() => props.message.role === 'user')
const uniqueSources = computed(() => {
  const srcs = props.message.sources
  if (!srcs?.length) return []
  const seen = new Set<string>()
  return srcs.filter((s: MessageSource) => {
    const key = s.docId || s.chunkId || ''
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })
})
const displayContent = computed(() => {
  const content = props.message.content || ''
  // Strip attachment markers like [Attached: filename.pdf] from display
  return content.replace(/\s*\[Attached:\s*[^\]]+\]/g, '').trim()
})
const attachmentNames = computed(() => {
  const matches = (props.message.content || '').match(/\[Attached:\s*([^\]]+)\]/g)
  if (!matches) return []
  return matches.map((m) => m.replace(/^\[Attached:\s*/, '').replace(/\]$/, ''))
})
const renderedContent = computed(() => {
  try {
    return marked.parse(displayContent.value)
  } catch {
    return displayContent.value
  }
})
const formattedTime = computed(() => {
  if (!props.message.createdAt && !props.message.id) return ''
  const d = new Date(props.message.createdAt || Number(props.message.id))
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
})

async function downloadSource(src: MessageSource) {
  try {
    const res = await api.get(`/knowledge-stores/${src.storeId}/documents/${src.docId}/download`, {
      responseType: 'blob',
    })
    const contentType = res.headers['content-type'] || 'application/octet-stream'
    const blob = new Blob([res.data], { type: contentType })
    const url = URL.createObjectURL(blob)
    window.open(url, '_blank')
  } catch (err) {
    console.error('Failed to download source document', err)
  }
}
</script>
