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

      <!-- Tool calls -->
      <div v-if="!isUser && message.toolCalls?.length" class="mt-2 pt-2 border-t border-border/50">
        <div
          class="flex items-center gap-1 text-[0.65rem] text-muted-foreground/80 font-medium mb-1.5"
        >
          <Wrench class="h-3 w-3" />
          Tools used
        </div>
        <div class="flex flex-col gap-1">
          <div
            v-for="(tc, i) in message.toolCalls"
            :key="tc.id || i"
            class="rounded-md border border-border/60 text-xs overflow-hidden"
          >
            <!-- Toggle header -->
            <button
              type="button"
              class="flex w-full items-center gap-2 px-2 py-1.5 bg-muted/40 hover:bg-muted/70 transition-colors text-left"
              @click="toggleToolCall(tc.id || String(i))"
            >
              <span
                class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-sm bg-primary/10 text-primary font-mono text-[0.6rem] shrink-0"
              >
                <Wrench class="h-2.5 w-2.5" />
                {{ tc.name }}
              </span>
              <span v-if="tc.error" class="text-[0.6rem] text-destructive truncate flex-1"
                >Error</span
              >
              <span v-else class="text-[0.6rem] text-muted-foreground truncate flex-1"
                >Result available</span
              >
              <ChevronDown
                :class="[
                  'h-3 w-3 text-muted-foreground shrink-0 transition-transform duration-150',
                  expandedToolCalls.has(tc.id || String(i)) ? 'rotate-180' : '',
                ]"
              />
            </button>

            <!-- Expanded content -->
            <div v-if="expandedToolCalls.has(tc.id || String(i))" class="divide-y divide-border/40">
              <!-- Arguments -->
              <div class="px-2 py-1.5">
                <div
                  class="text-[0.6rem] text-muted-foreground font-medium mb-1 uppercase tracking-wide"
                >
                  Input
                </div>
                <pre
                  class="text-[0.65rem] leading-relaxed text-foreground/80 whitespace-pre-wrap break-all font-mono"
                  >{{ JSON.stringify(tc.arguments, null, 2) }}</pre
                >
              </div>
              <!-- Result -->
              <div class="px-2 py-1.5">
                <div
                  class="text-[0.6rem] text-muted-foreground font-medium mb-1 uppercase tracking-wide"
                >
                  Output
                </div>
                <pre
                  v-if="!tc.error"
                  class="text-[0.65rem] leading-relaxed text-foreground/80 whitespace-pre-wrap break-all font-mono"
                  >{{ formatToolResult(tc.result) }}</pre
                >
                <span v-else class="inline-flex items-center gap-1 text-[0.65rem] text-destructive">
                  <AlertCircle class="h-3 w-3 shrink-0" />{{ tc.error }}
                </span>
              </div>
            </div>
          </div>
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
import { computed, ref } from 'vue'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import {
  Bot,
  User,
  Loader2,
  Paperclip,
  FileText,
  Wrench,
  ChevronDown,
  AlertCircle,
} from 'lucide-vue-next'
import api from '@/lib/api'
import type { ChatMessage, MessageSource } from '@/types'

const props = defineProps<{
  message: ChatMessage
  isStreaming?: boolean
}>()

// ── Tool call expand/collapse ──
const expandedToolCalls = ref(new Set<string>())
function toggleToolCall(key: string) {
  if (expandedToolCalls.value.has(key)) {
    expandedToolCalls.value.delete(key)
  } else {
    expandedToolCalls.value.add(key)
  }
  // Trigger reactivity — replace the Set
  expandedToolCalls.value = new Set(expandedToolCalls.value)
}
function formatToolResult(result: string): string {
  try {
    return JSON.stringify(JSON.parse(result), null, 2)
  } catch {
    return result
  }
}
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
    const raw = marked.parse(displayContent.value, { async: false }) as string
    return DOMPurify.sanitize(raw, {
      ALLOWED_TAGS: [
        'p',
        'br',
        'strong',
        'em',
        'code',
        'pre',
        'ul',
        'ol',
        'li',
        'blockquote',
        'h1',
        'h2',
        'h3',
        'h4',
        'h5',
        'h6',
        'a',
        'table',
        'thead',
        'tbody',
        'tr',
        'th',
        'td',
        'hr',
        'img',
      ],
      ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'target'],
      FORCE_BODY: true,
    })
  } catch {
    return displayContent.value
  }
})
const formattedTime = computed(() => {
  if (!props.message.createdAt) return ''
  const d = new Date(props.message.createdAt)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
})

async function downloadSource(src: MessageSource) {
  try {
    const res = await api.get(`/knowledge/${src.storeId}/documents/${src.docId}/download`, {
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
