# Changelog

All notable changes to DeltaChat will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- **Sidebar is now the single panel** – the navigation drawer (`AppNavigation.vue`) contains the full chat list (New Chat button, search, All/Saved filter, chat items with bookmark/delete actions, folder groups). The separate internal sidebar that was embedded inside `ChatInterface.vue` has been removed entirely.
- **Welcome screen** – when no chat is active, the main area now shows a large Δ logo, a greeting heading, and a subtitle. Typing a message and pressing Enter automatically creates a new chat and sends the message without any dialog.
- **`ai_models` collection** – named model configurations that users select when starting a chat. Each config stores display name, type (`model`|`webhook`|`agent`), provider, provider model, system prompt, temperature, max tokens, linked knowledge stores, and linked tools.
- **`agents` collection** – reusable agent definitions with system prompt, provider, knowledge stores (each auto-gains a `retrieve()` tool), and tools.
- **`tools` collection** – tool definitions of type `mcp`, `python`, or `typescript`, each with a JSON config blob.
- **New API routes**: `GET/POST/PUT/DELETE /api/models`, `/api/agents`, `/api/tools`.
- **ChatService model resolution** – when a message includes a `modelId`, the service looks up the named model config and applies its provider model, system prompt, knowledge stores, and temperature automatically. If the model type is `agent`, the linked agent config is resolved instead.
- **Chat `modelId` field** – chats now store the selected named model ID alongside the raw model string for backward compat.
- **Chat `folder` field** – chats can be grouped into named folders in the sidebar.
- **Chat `bookmarked` field** – chats can be saved/bookmarked and filtered via the Saved tab.
- **`PATCH /api/chats/:id`** – chat updates now exposed via the store's `updateChat()` action.
- **Settings page redesigned** with a left-side navigation panel (200 px) and five tabs:
  1. **Model Providers** – configure API keys and base URLs.
  2. **Models** – create/edit/delete named model configurations that users chat with; supports model, webhook, and agent types.
  3. **Knowledge Stores** – manage stores and upload documents (moved from its own top-level page).
  4. **Agents** – define agents with system prompts, knowledge stores, and tools.
  5. **Tools** – add MCP servers, Python, or TypeScript function tools.
- **Sidebar redesigned** – collapsed rail shows **only** the Δ logo avatar (click it to expand); expanded sidebar shows Δ logo + "DeltaChat" text + a collapse chevron. There is no visible chevron when collapsed.
- **Sidebar nav item** – single item that shows `+` icon when collapsed and "New Chat" label when expanded. Clicking it clears the current chat and returns to the welcome screen.
- **Model selector in chat** now shows named model configs (from `/api/models`) instead of raw provider model strings.
- **New Chat dialog** supports optional folder assignment.
- Inline bookmark button on each chat list item.
- New Pinia stores: `stores/models.js`, `stores/agents.js`, `stores/tools.js`.
- Knowledge Stores removed from the main left navigation (it lives in Settings now).

### Changed
- `App.vue` – `AppNavigation` (chat sidebar) is now **hidden on the `/settings` route**; the nav-icon is also hidden on settings, and the DeltaChat brand title is always shown in the app bar when on settings.
- `ChatInterface.vue` – attachment button now sits **left of the send button** in a horizontal row (previously stacked vertically above the send button).
- `SettingsPanel.vue` – settings left sidebar now supports collapsible rail mode matching the chat sidebar pattern: collapsed shows icons only (56 px) with a `›` chevron to expand; expanded shows icon + text (200 px) with a `‹` chevron to collapse; active tab is always highlighted.
- `docs/screenshots` – removed 7 stale/unreferenced screenshots (`chat-light.png`, `chat-collapsed.png`, `knowledge.png`, `settings-agents.png`, `settings-mobile.png`, `settings-knowledge.png`, `settings-tools.png`); all 6 remaining screenshots refreshed to reflect current UI.
- `ChatInterface.vue` – internal `<aside class="chat-sidebar">` removed; component is now the chat area only (toolbar + messages + input). Input area always visible; `sendMessage()` auto-creates a chat when `currentChatId` is null; toolbar model selector always visible on desktop; `loadMessages` triggered by watching `currentChatId`.
- `AppNavigation.vue` – takes over chat list responsibilities (search, filter, chat items, folder groups, bookmark/delete); collapsed rail shows `+` icon only; expanded shows full chat UI; clicking a chat item selects it and loads its messages.
- `router/index.js` – removed `/knowledge` route; only `/` and `/settings` remain.
- `chat.js` store – `loadMessages` now calls `GET /api/chats/:id` and reads `.messages` from the response (fixing the previous 404 on a non-existent `/messages` sub-path).
- `schema.ts` – added `modelId`, `folder`, `bookmarked` fields to the `chats` schema.

---

## [0.1.0] – 2025-01-01 – Initial release

### Added
- Real-time streaming chat via Socket.io and SSE.
- Support for multiple AI providers: OpenAI, Google Gemini, Ollama, Webhook.
- Knowledge Stores with RAG retrieval (ChromaDB vector store).
- MCP (Model Context Protocol) client for tool use.
- Webhook integration for n8n and similar automation platforms.
- DeltaDatabase as the sole primary data store.
- Vue 3 + Vuetify 3 frontend served by nginx.
- Docker Compose setup for one-command deployment.
