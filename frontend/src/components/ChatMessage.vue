<template>
  <div :class="['flex mb-4 animate-[messageSlideIn_0.25s_ease-out]', isUser ? 'justify-end' : 'justify-start']" style="max-width: 800px; margin-left: auto; margin-right: auto; width: 100%;">
    <!-- Bot avatar -->
    <div v-if="!isUser" class="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground mr-3 mt-1 shrink-0 shadow-md shadow-primary/30">
      <Bot class="h-5 w-5" />
    </div>

    <!-- Message bubble -->
    <div :class="['max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed relative', isUser ? 'bg-primary text-primary-foreground rounded-br-sm shadow-lg shadow-primary/25' : 'bg-muted border border-border rounded-bl-sm']">
      <div v-if="isUser">
        <div v-if="attachmentNames.length" class="flex items-center gap-1.5 mb-1.5 text-xs opacity-80">
          <Paperclip class="h-3 w-3" />
          <span v-for="name in attachmentNames" :key="name">{{ name }}</span>
        </div>
        <div v-if="displayContent" class="whitespace-pre-wrap">{{ displayContent }}</div>
      </div>
      <div v-else-if="isStreaming && !message.content" class="flex items-center gap-2">
        <Loader2 class="h-4 w-4 animate-spin text-primary" />
        <span class="text-xs text-muted-foreground">Thinking…</span>
      </div>
      <div v-else class="markdown-body" v-html="renderedContent" />

      <!-- RAG Sources -->
      <div v-if="!isUser && sources.length > 0" class="mt-2 border-t border-border/50 pt-2">
        <button
          class="flex items-center gap-1 text-[0.7rem] text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
          @click="showSources = !showSources"
        >
          <FileText class="h-3 w-3" />
          <span>{{ sources.length }} source{{ sources.length > 1 ? 's' : '' }}</span>
          <ChevronDown :class="['h-3 w-3 transition-transform', showSources ? 'rotate-180' : '']" />
        </button>
        <div v-if="showSources" class="mt-1.5 space-y-1.5">
          <div
            v-for="(src, i) in sources"
            :key="i"
            class="text-[0.7rem] rounded-md bg-background/60 border border-border/40 px-2.5 py-1.5"
          >
            <div class="flex items-center justify-between gap-2 mb-0.5">
              <span class="font-medium text-foreground/80 truncate">{{ src.filename || 'Unknown document' }}</span>
              <span class="text-muted-foreground/60 shrink-0">{{ (src.score * 100).toFixed(0) }}%</span>
            </div>
            <p class="text-muted-foreground/70 line-clamp-2">{{ src.text }}</p>
          </div>
        </div>
      </div>

      <div :class="['text-[0.65rem] mt-1', isUser ? 'text-primary-foreground/60' : 'text-muted-foreground/60']">
        {{ formattedTime }}
      </div>
    </div>

    <!-- User avatar -->
    <div v-if="isUser" class="flex h-8 w-8 items-center justify-center rounded-lg bg-secondary text-secondary-foreground ml-3 mt-1 shrink-0 shadow-md">
      <User class="h-5 w-5" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { marked } from 'marked'
import { Bot, User, Loader2, Paperclip, FileText, ChevronDown } from 'lucide-vue-next'

const props = defineProps({
  message: Object,
  isStreaming: { type: Boolean, default: false }
})
const isUser = computed(() => props.message.role === 'user')
const sources = computed(() => props.message.sources || [])
const showSources = ref(false)
const displayContent = computed(() => {
  const content = props.message.content || ''
  // Strip attachment markers like [Attached: filename.pdf] from display
  return content.replace(/\s*\[Attached:\s*[^\]]+\]/g, '').trim()
})
const attachmentNames = computed(() => {
  const matches = (props.message.content || '').match(/\[Attached:\s*([^\]]+)\]/g)
  if (!matches) return []
  return matches.map(m => m.replace(/^\[Attached:\s*/, '').replace(/\]$/, ''))
})
const renderedContent = computed(() => {
  try { return marked.parse(displayContent.value) } catch { return displayContent.value }
})
const formattedTime = computed(() => {
  if (!props.message.createdAt && !props.message.id) return ''
  const d = new Date(props.message.createdAt || props.message.id)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
})
</script>
