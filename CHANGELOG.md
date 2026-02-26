# Changelog

All notable changes to DeltaChat will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
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
- `ChatInterface.vue` – input area is always visible (not hidden when no chat is selected); `sendMessage()` auto-creates a chat when `currentChatId` is null; toolbar model selector always visible on desktop.
- `AppNavigation.vue` – sidebar nav item changed from `mdi-chat / Chat` to `mdi-plus / New Chat`; collapsed rail shows only the logo, no chevron button.
- `AppNavigation.vue` – sidebar only shows the Chat workspace icon; Knowledge is accessible via Settings.
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
