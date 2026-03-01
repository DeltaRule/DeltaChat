<template>
  <div :class="['message-row', 'd-flex', 'mb-4', isUser ? 'justify-end' : 'justify-start']">
    <v-avatar v-if="!isUser" color="primary" size="34" class="mr-3 mt-1 message-avatar" rounded="lg">
      <v-icon icon="mdi-robot" size="20" />
    </v-avatar>
    <div :class="['message-bubble', isUser ? 'message-user' : 'message-assistant']">
      <div v-if="isUser" class="text-body-2" style="white-space: pre-wrap;">{{ message.content }}</div>
      <div v-else class="text-body-2 markdown-body" v-html="renderedContent" />
      <div class="message-time text-caption mt-1">{{ formattedTime }}</div>
    </div>
    <v-avatar v-if="isUser" color="secondary" size="34" class="ml-3 mt-1 message-avatar" rounded="lg">
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
/* Message layout */
.message-row {
  max-width: 800px;
  margin-left: auto;
  margin-right: auto;
  width: 100%;
  animation: messageSlideIn 0.25s ease-out;
}

@keyframes messageSlideIn {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.message-avatar {
  flex-shrink: 0;
  box-shadow: 0 3px 12px rgba(0, 0, 0, 0.2);
}

.message-bubble {
  max-width: 75%;
  padding: 14px 18px;
  border-radius: 18px;
  line-height: 1.6;
  position: relative;
}

.message-user {
  background: linear-gradient(135deg, rgba(124, 77, 255, 0.95), rgba(101, 31, 255, 0.85));
  color: #fff;
  border-bottom-right-radius: 4px;
  box-shadow: 0 4px 16px rgba(124, 77, 255, 0.25);
}

.message-assistant {
  background: rgba(var(--v-theme-surface-variant), 0.5);
  border: 1px solid rgba(var(--v-border-color), 0.08);
  border-bottom-left-radius: 4px;
  backdrop-filter: blur(8px);
}

.v-theme--light .message-assistant {
  background: rgba(255, 255, 255, 0.9);
  border: 1px solid rgba(0, 0, 0, 0.06);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.message-time {
  opacity: 0.5;
  font-size: 0.7rem;
}

.message-user .message-time {
  opacity: 0.7;
}

/* Markdown rendering */
.markdown-body p { margin-bottom: 10px; line-height: 1.7; }
.markdown-body p:last-child { margin-bottom: 0; }
.markdown-body pre {
  background: rgba(0, 0, 0, 0.3);
  padding: 16px 18px;
  border-radius: 12px;
  overflow-x: auto;
  margin: 10px 0;
  font-size: 0.85em;
  border: 1px solid rgba(255, 255, 255, 0.06);
  backdrop-filter: blur(4px);
}
.v-theme--light .markdown-body pre {
  background: #f4f4fa;
  border: 1px solid rgba(0, 0, 0, 0.06);
  backdrop-filter: none;
}
.markdown-body code {
  font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace;
  font-size: 0.85em;
}
.markdown-body :not(pre) > code {
  background: rgba(124, 77, 255, 0.1);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 0.85em;
}
.markdown-body ul, .markdown-body ol { padding-left: 20px; margin: 8px 0; }
.markdown-body li { margin-bottom: 4px; }
.markdown-body blockquote {
  border-left: 3px solid rgba(124, 77, 255, 0.4);
  margin: 8px 0;
  padding: 4px 12px;
  opacity: 0.85;
}
.markdown-body h1, .markdown-body h2, .markdown-body h3 {
  margin-top: 16px;
  margin-bottom: 8px;
  font-weight: 600;
}
.markdown-body a {
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}
.markdown-body a:hover {
  text-decoration: underline;
}
.markdown-body table {
  border-collapse: collapse;
  margin: 8px 0;
  width: 100%;
}
.markdown-body th, .markdown-body td {
  padding: 6px 12px;
  border: 1px solid rgba(var(--v-border-color), 0.2);
  text-align: left;
}
.markdown-body th {
  font-weight: 600;
  background: rgba(var(--v-theme-surface-variant), 0.4);
}
</style>
