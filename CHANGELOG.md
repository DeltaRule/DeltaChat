# Changelog

All notable changes to DeltaChat will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
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
- **Chat sidebar** now has All / Saved filter tabs and folder groups (expandable `v-list-group` per folder name).
- **Model selector in chat** now shows named model configs (from `/api/models`) instead of raw provider model strings.
- **New Chat dialog** supports optional folder assignment.
- Inline bookmark button on each chat list item.
- New Pinia stores: `stores/models.js`, `stores/agents.js`, `stores/tools.js`.
- Knowledge Stores removed from the main left navigation (it lives in Settings now).

### Changed
- `ChatInterface.vue` – chat store `createChat()` now accepts `(title, modelId, folder)` instead of `(name, model)`.
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
