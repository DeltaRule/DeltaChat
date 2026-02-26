# Changelog

All notable changes to DeltaChat will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).

---

## [Unreleased]

### Added
- **Left sidebar navigation** – workspaces (Chat, Knowledge) are now accessible via a collapsible icon-only sidebar on the left, inspired by modern chat apps (Slack / Discord style).
- **Expandable sidebar** – clicking the chevron or the hamburger menu icon expands the rail from icon-only to icon + label mode.
- **Settings icon in top-right corner** – Settings is no longer a top-level navigation link but a dedicated ⚙ button in the top-right of the app bar.
- **Connection status indicator** moved to the top bar alongside the theme toggle and settings button.
- **Mobile-responsive layout** – the sidebar becomes a temporary overlay drawer on small screens; a hamburger icon in the app bar toggles it. The chat sidebar and model/knowledge selectors adapt gracefully to narrow viewports.
- **Chat sidebar toggle on mobile** – a menu button in the chat toolbar opens/closes the conversation list when on a small screen.
- **Mobile model & knowledge selectors** – appear below the chat input on mobile so they don't crowd the toolbar.
- **Improved empty states** – more descriptive placeholder copy and icons on the chat, knowledge, and settings screens.
- **Settings page redesign** – tabbed layout with icons on each tab, improved card headers, and consistent save buttons with icons.
- **Knowledge Stores redesign** – improved card layout, empty-state illustration, and cleaner document list.
- `CHANGELOG.md` – this file.

### Changed
- `AppNavigation.vue` converted from `v-app-bar` navigation links to a `v-navigation-drawer` with Vuetify 3 `rail` mode (icon-only) that expands on demand.
- `App.vue` redesigned: navigation drawer + minimal top app bar (`density="compact"`) replaces the full-height primary colored bar.
- `ChatInterface.vue` refactored with CSS flexbox layout instead of Vuetify grid columns, enabling a proper full-height chat window and a slide-in mobile sidebar.
- `KnowledgeStores.vue` – replaced absolute column sizes with responsive `sm`/`md` breakpoints and added an empty-state panel when no store is selected.
- `SettingsPanel.vue` – all tabs now have leading icons; provider cards have dividers; labels match the body-1 / font-weight-bold style used throughout the app.
- README screenshots section updated to reflect the new UI.

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
