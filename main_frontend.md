# DeltaChat Frontend — Structural Overview & Target Architecture

**Last updated:** April 24, 2026
**Based on:** Full codebase audit + structural decisions

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [Directory Layout (Target)](#2-directory-layout-target)
3. [Architecture Layers](#3-architecture-layers)
4. [Router & Navigation](#4-router--navigation)
5. [Store Architecture](#5-store-architecture)
6. [Component Architecture](#6-component-architecture)
7. [Authentication Flow](#7-authentication-flow)
8. [API Layer](#8-api-layer)
9. [TypeScript Migration](#9-typescript-migration)
10. [Consistency Rules](#10-consistency-rules)

---

## 1. Technology Stack

| Layer             | Technology                                       | Version |
| ----------------- | ------------------------------------------------ | ------- |
| Framework         | Vue 3 (Composition API, `<script setup>`)        | 3.5.x   |
| Language          | TypeScript (strict)                              | 5.x     |
| State             | Pinia                                            | 3.x     |
| Router            | Vue Router 4                                     | 4.x     |
| Build             | Vite + @tailwindcss/vite                         | latest  |
| UI Primitives     | radix-vue (reka-ui)                              | 1.x     |
| Component Library | shadcn-vue (local, in `src/components/ui/`)      | —       |
| CSS               | Tailwind CSS 4                                   | 4.x     |
| Icons             | lucide-vue-next                                  | —       |
| HTTP              | axios (centralized instance in `src/lib/api.ts`) | —       |
| Real-time         | socket.io-client                                 | —       |
| Markdown          | marked + DOMPurify (sanitization required)       | —       |
| Toasts            | vue-sonner                                       | —       |
| Cookies           | js-cookie                                        | —       |
| Math              | KaTeX (if needed)                                | —       |

---

## 2. Directory Layout (Target)

```
frontend/src/
├── main.ts                         ← App bootstrap (Vue + Pinia + Router)
├── App.vue                         ← Root layout: header, sidebar, router-view, toasts
├── env.d.ts                        ← import.meta.env types
├── router/
│   └── index.ts                    ← All routes; beforeEach guards for auth + admin
├── stores/                         ← All Pinia stores (.ts only — see §9)
│   ├── auth.ts                     ← Login, logout, refresh token, user state
│   ├── chat.ts                     ← Chats CRUD, messages, streaming
│   ├── models.ts                   ← AI model configs CRUD
│   ├── agents.ts                   ← Agent configs CRUD
│   ├── tools.ts                    ← Tool configs CRUD
│   ├── knowledge.ts                ← Knowledge stores + documents CRUD + polling
│   ├── settings.ts                 ← Global settings + webhooks
│   ├── sharing.ts                  ← Resource sharing management
│   ├── users.ts                    ← User management (admin)
│   ├── userGroups.ts               ← Group management (admin)
│   ├── mcpConnections.ts           ← MCP connection management
│   ├── notification.ts             ← Toast notifications
│   └── theme.ts                    ← Dark/light mode, color presets
├── composables/
│   ├── useSidebar.ts               ← Sidebar state + keyboard shortcut (Ctrl+B)
│   └── useSettingsState.ts         ← Settings panel state injection
├── lib/
│   ├── api.ts                      ← Centralized axios instance + interceptors
│   └── utils.ts                    ← cn() class merging utility
├── types/
│   └── index.ts                    ← All domain types (AiModel, Chat, Message, etc.)
├── views/
│   ├── ChatView.vue                ← Wraps ChatInterface
│   ├── SettingsView.vue            ← Wraps SettingsPanel
│   ├── KnowledgeView.vue           ← Wraps KnowledgeStores (needs /knowledge route)
│   ├── LoginView.vue               ← Login + Google OAuth entry
│   └── AdminView.vue               ← Admin panel (users, groups, SCIM)
├── components/
│   ├── AppNavigation.vue           ← Sidebar navigation (collapsible, mobile-aware)
│   ├── SidebarInner.vue            ← Chat list (search, filter, folders, bookmarks)
│   ├── ChatInterface.vue           ← Main chat area (messages, model selector, input)
│   ├── ChatMessage.vue             ← Single message (XSS-safe markdown rendering)
│   ├── SettingsPanel.vue           ← Full settings hub (6 tabs)
│   ├── KnowledgeStores.vue         ← Knowledge store management
│   ├── ShareDialog.vue             ← Resource sharing dialog
│   └── ui/                         ← shadcn-vue component library (local)
│       ├── button/
│       ├── input/
│       ├── textarea/
│       ├── select/
│       ├── switch/
│       ├── label/
│       ├── card/
│       ├── dialog/
│       ├── sheet/
│       ├── badge/
│       ├── separator/
│       ├── scroll-area/
│       ├── tooltip/
│       ├── avatar/
│       └── dropdown-menu/
└── styles/
    └── globals.css                 ← CSS variables (design tokens), global resets
```

---

## 3. Architecture Layers

```
┌────────────────────────────────────────────────────────┐
│                     Views (pages)                       │
│   ChatView | SettingsView | KnowledgeView | LoginView   │
│                  AdminView                              │
├────────────────────────────────────────────────────────┤
│               Feature Components                        │
│   ChatInterface | SettingsPanel | KnowledgeStores       │
│   AppNavigation | SidebarInner | ChatMessage            │
├────────────────────────────────────────────────────────┤
│               UI Components (shadcn-vue)               │
│   Button | Dialog | Select | Input | Badge | ...        │
├────────────────────────────────────────────────────────┤
│                    Pinia Stores                          │
│   auth | chat | models | knowledge | settings | ...     │
├────────────────────────────────────────────────────────┤
│                    API Layer                             │
│    src/lib/api.ts (axios) + socket.io-client            │
└────────────────────────────────────────────────────────┘
```

**Rules:**

- Views are thin wrappers — they import one feature component and nothing else
- Feature components use Pinia stores; they **never** call `api` directly
- Stores call `api.ts` for HTTP and `socket` for real-time; they never call other stores
- UI components (`ui/`) have no store or API dependencies — pure presentational

---

## 4. Router & Navigation

### Target Routes

```ts
const routes = [
  { path: '/login', component: LoginView, meta: { requiresGuest: true } },
  { path: '/', component: ChatView, meta: { requiresAuth: true } },
  { path: '/settings', component: SettingsView, meta: { requiresAuth: true } },
  { path: '/knowledge', component: KnowledgeView, meta: { requiresAuth: true } },
  { path: '/admin', component: AdminView, meta: { requiresAuth: true, requiresAdmin: true } },
]
```

### Navigation Guard (target)

```ts
router.beforeEach((to, _from, next) => {
  const auth = useAuthStore() // ← use Pinia store, not localStorage directly
  const isAuthenticated = !!auth.token
  const isAdmin = auth.isAdmin

  if (to.meta.requiresGuest && isAuthenticated) return next('/')
  if (to.meta.requiresAuth && !isAuthenticated) return next('/login')
  if (to.meta.requiresAdmin && !isAdmin) return next('/')
  next()
})
```

**No direct `localStorage.getItem()` in the guard.**

### Navigation UI (App.vue)

The main header navigation shows:

- Logo → `/` (home / chat) — fix the tautological click handler
- Knowledge icon → `/knowledge` (once route is added)
- Settings icon → `/settings`
- Admin shield → `/admin` (visible only if `authStore.isAdmin`)

---

## 5. Store Architecture

### Universal Store Pattern (all stores)

Every store follows this exact structure:

```ts
// stores/exampleEntities.ts
import { ref, computed } from 'vue'
import { defineStore } from 'pinia'
import { api } from '../lib/api'
import { useNotificationStore } from './notification'
import type { ExampleEntity } from '../types'

export const useExampleEntitiesStore = defineStore('exampleEntities', () => {
  // ── State ────────────────────────────────────────────────
  const items = ref<ExampleEntity[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  // ── Computed ─────────────────────────────────────────────
  const count = computed(() => items.value.length)

  // ── Actions ──────────────────────────────────────────────
  async function loadItems(): Promise<void> {
    loading.value = true
    error.value = null
    try {
      const { data } = await api.get<ExampleEntity[]>('/example-entities')
      items.value = data
    } catch (e) {
      const msg = getErrorMessage(e, 'Failed to load items')
      error.value = msg
      useNotificationStore().error(msg)
    } finally {
      loading.value = false
    }
  }

  async function createItem(payload: Partial<ExampleEntity>): Promise<ExampleEntity | null> {
    loading.value = true
    try {
      const { data } = await api.post<ExampleEntity>('/example-entities', payload)
      items.value.push(data)
      useNotificationStore().success('Created successfully')
      return data
    } catch (e) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to create item'))
      return null
    } finally {
      loading.value = false
    }
  }

  // ... updateItem(), deleteItem() same pattern

  return { items, loading, error, count, loadItems, createItem }
})
```

### Store Responsibilities

| Store          | State                                                       | Key Actions                                                       |
| -------------- | ----------------------------------------------------------- | ----------------------------------------------------------------- |
| `auth`         | `token`, `refreshToken`, `user`                             | `login()`, `logout()`, `refreshAccessToken()`                     |
| `chat`         | `chats[]`, `messages{}`, `streamingMessageId`               | `loadChats()`, `createChat()`, `sendMessage()`, `streamMessage()` |
| `models`       | `models[]`, `loading`, `error`                              | `loadModels()`, `createModel()`, `updateModel()`, `deleteModel()` |
| `agents`       | `agents[]`, `loading`, `error`                              | full CRUD                                                         |
| `tools`        | `tools[]`, `loading`, `error`                               | full CRUD                                                         |
| `knowledge`    | `stores[]`, `documents{}`, `pollTimers`, `loading`, `error` | full CRUD + `uploadDocument()` + polling                          |
| `settings`     | `settings`, `webhooks[]`, `loading`, `error`                | `loadSettings()`, `saveSettings()`, webhook CRUD                  |
| `sharing`      | `shares[]`, `loading`, `error`                              | `loadShares()`, `shareResource()`, `revokeShare()`                |
| `notification` | —                                                           | `success()`, `error()`, `info()`, `warning()`                     |
| `theme`        | `isDark`, `colors`                                          | `toggleTheme()`, `setPreset()`, `setCustomColor()`                |

### `chat.ts` Store — Socket.IO Pattern

The Socket.IO connection must be created **after authentication** and destroyed on logout:

```ts
// stores/chat.ts
let socket: Socket | null = null

function connectSocket(): void {
  const auth = useAuthStore()
  if (socket) socket.disconnect()
  socket = io(API_URL, {
    auth: { token: auth.token },
  })
  socket.on('chat:chunk', handleChunk)
  socket.on('chat:done', handleDone)
  socket.on('chat:error', handleError)
}

function disconnectSocket(): void {
  socket?.disconnect()
  socket = null
}

// Call connectSocket() from auth.ts after login
// Call disconnectSocket() from auth.ts on logout
```

### `auth.ts` Store — Refresh Token Flow

```ts
// stores/auth.ts
const token = ref<string | null>(null) // access token — IN MEMORY ONLY (not localStorage)
const user = ref<User | null>(null)

async function login(email: string, password: string): Promise<void> {
  const { data } = await api.post('/auth/login', { email, password })
  token.value = data.accessToken // store in memory only
  user.value = data.user
  // refreshToken is in a HttpOnly cookie — set by server, never touched by JS
  await useChatStore().connectSocket()
}

async function logout(): Promise<void> {
  await api.post('/auth/logout') // server clears the refresh cookie
  token.value = null
  user.value = null
  useChatStore().disconnectSocket()
  router.push('/login')
}

async function refreshAccessToken(): Promise<boolean> {
  try {
    const { data } = await api.post('/auth/refresh') // cookies sent automatically
    token.value = data.accessToken
    return true
  } catch {
    await logout()
    return false
  }
}
```

The access token lives only in Pinia memory — not `localStorage`, not a cookie. It is re-fetched on page load via `refreshAccessToken()` (which reads the HttpOnly refresh cookie automatically).

### `knowledge.ts` Store — Poll Timer Cleanup

```ts
const _pollTimers: Map<string, ReturnType<typeof setInterval>> = new Map()

function stopPolling(docId: string): void {
  const t = _pollTimers.get(docId)
  if (t) {
    clearInterval(t)
    _pollTimers.delete(docId)
  }
}

// On store teardown / $reset
function stopAllPolling(): void {
  _pollTimers.forEach((t) => clearInterval(t))
  _pollTimers.clear()
}
```

---

## 6. Component Architecture

### Component Rules

1. **No API calls inside components.** Components call store actions only.
2. **`v-html` is only allowed with DOMPurify sanitization.** Never raw `marked.parse()`.
3. **All `async` initializations** happen in `onMounted`, never at `<script setup>` top level.
4. **Event emit names** follow `kebab-case`: `@update:modelValue`, `@close`, `@submit`.
5. **Prop definitions** always use the TypeScript generic form: `defineProps<{...}>()`.
6. **No `as any` casts.** If a type is incomplete, fix the type definition instead.

### `ChatMessage.vue` — XSS-Safe Markdown

```ts
import DOMPurify from 'dompurify'
import { marked } from 'marked'

const renderedContent = computed(() => {
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
})
```

Also fix: use `/knowledge/${src.storeId}/documents/${src.docId}/download` (not `/knowledge-stores/`).

### `SettingsPanel.vue` — Tab Structure

Six tabs, driven by `tabComponentMap: Record<string, Component>`:

| Tab Key      | Component       | Admin Only? |
| ------------ | --------------- | ----------- |
| `providers`  | `ProvidersTab`  | ✅          |
| `models`     | `ModelsTab`     | —           |
| `knowledge`  | `KnowledgeTab`  | —           |
| `agents`     | `AgentsTab`     | —           |
| `tools`      | `ToolsTab`      | —           |
| `appearance` | `AppearanceTab` | —           |

### `KnowledgeStores.vue` — Two-Step Create Flow

Replace the current minimal create dialog with a two-step flow:

**Step 1 — Quick Create:**

```
Name (required)
Description (optional)
[ Create ] [ Cancel ]
```

Creates the store with server-default pipeline config.

**Step 2 — Edit (inline or route to `/knowledge/:id`):**
Full config form exposed via an "Edit" button or by clicking the newly created store:

```
Embedding Model    [selector]
Vector Store Type  [local / Chroma]
Document Processor [LangChain / Tika / Docling]
Chunk Size         [numeric input, default 1000]
Chunk Overlap      [numeric input, default 100]
[ Save ]
```

This means the standalone `KnowledgeStores.vue` and the `KnowledgeTab.vue` inside Settings both use the same two-step flow and produce identically configured stores.

### `ShareDialog.vue` — TypeScript Migration

Replace options-style `defineProps` with:

```ts
const props = defineProps<{
  open: boolean
  resourceType: 'chat' | 'knowledge_store' | 'ai_model' | 'agent' | 'tool' | 'webhook'
  resourceId: string
  resourceLabel?: string
}>()
```

---

## 7. Authentication Flow

### Page Load Sequence

```
App.vue onMounted
  → auth.refreshAccessToken()
    → POST /api/auth/refresh (HttpOnly cookie sent automatically)
    → on success: token stored in Pinia memory, user hydrated
    → on failure: redirect to /login

/login page
  → user enters credentials → auth.login()
    → POST /api/auth/login
    → server returns: { accessToken, user } + sets HttpOnly refresh cookie
    → Pinia stores accessToken in memory (not localStorage)
    → connectSocket() called with the new token
    → router.push('/')

Logout
  → auth.logout()
    → POST /api/auth/logout (server revokes refresh token, clears cookie)
    → Pinia clears token + user
    → disconnectSocket()
    → router.push('/login')

Token Expiry During Session
  → api.ts interceptor catches 401
    → calls auth.refreshAccessToken()
    → if successful: retries original request
    → if failed: calls auth.logout() → redirect to /login
```

### Axios Interceptor: Auto-Refresh on 401

```ts
// lib/api.ts
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401 && !err.config._retry) {
      err.config._retry = true
      const auth = useAuthStore()
      const ok = await auth.refreshAccessToken()
      if (ok) {
        err.config.headers['Authorization'] = `Bearer ${auth.token}`
        return api(err.config)
      }
    }
    return Promise.reject(err)
  },
)
```

---

## 8. API Layer

### `src/lib/api.ts` — Canonical Axios Instance

```ts
import axios from 'axios'

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:3001/api',
  timeout: 30_000,
})

// Request interceptor: inject access token
api.interceptors.request.use((config) => {
  const auth = useAuthStore()
  if (auth.token) {
    config.headers['Authorization'] = `Bearer ${auth.token}`
  }
  return config
})

// Response interceptor: auto-refresh + 401 redirect (see §7)
```

**Rules:**

- All stores use `api.get/post/put/patch/delete(...)` — never raw `fetch()`
- `LoginView.vue` google-enabled check must switch to `api.get('/auth/google-enabled')`
- No `import.meta.env.VITE_API_URL` usage outside `lib/api.ts`

### Error Utility

```ts
// lib/utils.ts
export function getErrorMessage(err: unknown, fallback = 'An error occurred'): string {
  if (axios.isAxiosError(err)) {
    return err.response?.data?.error ?? err.message ?? fallback
  }
  if (err instanceof Error) return err.message
  return fallback
}
```

Used **consistently** in every store `catch` block. No inline `(e as any).response?.data?.error` casts.

---

## 9. TypeScript Migration

All `.js` files in `stores/` and `composables/` must be migrated to `.ts`. Target state:

| File                        | Current | Target |
| --------------------------- | ------- | ------ |
| `stores/chat.js`            | `.js`   | `.ts`  |
| `stores/models.js`          | `.js`   | `.ts`  |
| `stores/agents.js`          | `.js`   | `.ts`  |
| `stores/tools.js`           | `.js`   | `.ts`  |
| `stores/knowledge.js`       | `.js`   | `.ts`  |
| `stores/settings.js`        | `.js`   | `.ts`  |
| `stores/notification.js`    | `.js`   | `.ts`  |
| `stores/theme.js`           | `.js`   | `.ts`  |
| `composables/useSidebar.js` | `.js`   | `.ts`  |
| `lib/utils.js`              | `.js`   | `.ts`  |

### Type Completeness — `AiModel`

```ts
export interface AiModel {
  id: string
  name: string
  type: 'model' | 'embedding' | 'webhook' | 'agent' // remove 'chat' duplicate
  provider: string
  providerModel: string | null
  systemPrompt: string | null
  temperature: number | null
  maxTokens: number | null
  topK: number | null // ← add missing field
  chunkSize: number | null // ← already in schema, add to type
  chunkOverlap: number | null // ← already in schema, add to type
  knowledgeStoreIds: string[]
  toolIds: string[]
  webhookId: string | null
  agentId: string | null
  enabled: boolean
  ownerId: string | null
  metadata: Record<string, unknown>
}
```

### `AiModel.type` Model Selector Filter (fix FTS-1)

```ts
// ChatInterface.vue — only 'model' type should appear in chat model selector
const chatModels = computed(() => modelsStore.models.filter((m) => m.enabled && m.type === 'model'))
```

### `KnowledgeDocument.status` Badge (fix FTS-4)

```ts
function statusBadge(status?: string): BadgeVariant {
  switch (status) {
    case 'indexed':
      return 'success'
    case 'ready':
      return 'success'
    case 'processing':
      return 'warning'
    case 'error':
      return 'destructive'
    case 'failed':
      return 'destructive'
    default:
      return 'outline'
  }
}
```

---

## 10. Consistency Rules

These rules define what "consistent code" looks like across the entire frontend.

### 1 · Every Store Has `loading` + `error` State

```ts
const loading = ref(false)
const error = ref<string | null>(null)
```

Every async action sets `loading.value = true` before the request and `loading.value = false` in `finally`.

### 2 · Every `catch` Block Uses `getErrorMessage` + `notify.error()`

```ts
} catch (e) {
  const msg = getErrorMessage(e, 'Fallback message')
  error.value = msg
  useNotificationStore().error(msg)
}
```

Never: `console.error(e)` alone. Never: `(e as any).response.data.error` inline casting.

### 3 · No Direct `localStorage` Access Outside `auth.ts`

```ts
// ❌ Forbidden
localStorage.getItem('deltachat-token')

// ✅ Correct
useAuthStore().token
```

Exception: the theme store may use `localStorage` for persisting theme preferences (not sensitive).

### 4 · No Raw `fetch()` — Only `api` Instance

```ts
// ❌ Forbidden
const res = await fetch(`${API_URL}/api/auth/google-enabled`)

// ✅ Correct
const { data } = await api.get('/auth/google-enabled')
```

### 5 · Prop Definitions Always Use TypeScript Generic Form

```ts
// ❌ Forbidden
const props = defineProps({ open: Boolean, resourceId: String })

// ✅ Correct
const props = defineProps<{ open: boolean; resourceId: string }>()
```

### 6 · No `as any` Casts — Fix the Type Instead

If a field exists in the backend schema but not in the frontend type, add it to `types/index.ts`.

### 7 · `v-html` Requires DOMPurify Sanitization

```ts
// ❌ Forbidden
v-html="marked.parse(content)"

// ✅ Correct
v-html="DOMPurify.sanitize(marked.parse(content, { async: false }) as string)"
```

### 8 · Button Navigation Uses `@click` + `router.push()`

```ts
// ❌ Broken (reka-ui doesn't forward `to` reliably)
<Button as="router-link" :to="'/settings'">

// ✅ Correct
<Button @click="router.push('/settings')">
```

### 9 · Switch Bindings Use `:model-value` / `@update:model-value`

```html
<!-- ❌ Wrong -->
<Switch :checked="enabled" @update:checked="val => enabled = val" />

<!-- ✅ Correct -->
<Switch :model-value="enabled" @update:model-value="val => enabled = val" />
```

### 10 · Socket Event Listeners Are Cleaned Up on `onUnmounted`

```ts
onMounted(() => {
  socket.on('event', handler)
})
onUnmounted(() => {
  socket.off('event', handler)
})
```
