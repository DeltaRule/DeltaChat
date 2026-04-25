# DeltaChat Backend — Structural Overview & Target Architecture

**Last updated:** April 24, 2026
**Based on:** Full codebase audit + structural decisions

---

## Table of Contents

1. [Technology Stack](#1-technology-stack)
2. [Directory Layout (Target)](#2-directory-layout-target)
3. [Architecture Layers](#3-architecture-layers)
4. [Module System](#4-module-system)
5. [Service Layer Specification](#5-service-layer-specification)
6. [API Routes](#6-api-routes)
7. [Authentication & Authorization](#7-authentication--authorization)
8. [Database Layer](#8-database-layer)
9. [Configuration](#9-configuration)
10. [Consistency Rules](#10-consistency-rules)

---

## 1. Technology Stack

| Layer               | Technology                                     |
| ------------------- | ---------------------------------------------- |
| Runtime             | Node.js 20 (LTS)                               |
| Language            | TypeScript (strict mode)                       |
| Web Framework       | Express.js 4                                   |
| Real-time           | Socket.IO 4                                    |
| DB Client           | DeltaDatabase REST adapter (custom)            |
| Auth                | JWT (access + refresh) — see §7                |
| AI Providers        | OpenAI, Anthropic, Ollama, Groq, Gemini, Azure |
| Vector Stores       | Local (in-memory JSON), Chroma                 |
| Embedding           | OpenAI, Ollama, HuggingFace                    |
| Document Processing | LangChain, Apache Tika, Docling                |
| File Storage        | Local filesystem (configurable)                |
| Tool Execution      | MCP only (user code execution disabled)        |
| Build               | tsx / tsc                                      |

---

## 2. Directory Layout (Target)

```
backend/src/
├── app.ts                         ← Express app: middleware stack + global error handler
├── server.ts                      ← HTTP server + Socket.IO bootstrap
├── config/
│   └── index.ts                   ← All env-based config; throws on missing required vars
├── types/
│   ├── express.d.ts               ← Augments Request.user, Request.services
│   └── index.ts                   ← Shared domain types (Entity, ModelChatMessage, etc.)
├── db/
│   ├── DeltaDatabaseAdapter.ts    ← REST client wrapper; all DB I/O lives here
│   └── schema.ts                  ← JSON Schema definitions for all collections
├── middleware/
│   ├── auth.ts                    ← requireAuth, requireAdmin middleware
│   └── services.ts                ← Service injection into req.services
├── routes/
│   ├── index.ts                   ← Mounts all routers; global requireAuth
│   ├── auth.ts                    ← /api/auth/* (login, register, google, refresh, logout)
│   ├── settings.ts                ← /api/settings (admin-gated GET + PUT)
│   ├── models.ts                  ← /api/models CRUD
│   ├── agents.ts                  ← /api/agents CRUD
│   ├── tools.ts                   ← /api/tools CRUD (MCP-only, admin-gated create/edit)
│   ├── chat.ts                    ← /api/chats/:id/messages (send + stream)
│   ├── chats.ts                   ← /api/chats CRUD
│   ├── knowledge.ts               ← /api/knowledge CRUD + documents
│   ├── webhooks.ts                ← /api/webhooks CRUD
│   ├── mcp.ts                     ← /api/mcp proxy + listing endpoints (GET, not POST)
│   ├── mcpConnections.ts          ← /api/mcp-connections CRUD + SSRF-guarded URL validation
│   ├── sharing.ts                 ← /api/sharing resource share management
│   ├── scim.ts                    ← /api/scim SCIM 2.0 provisioning
│   └── users.ts                   ← /api/users (admin-gated user management)
├── services/
│   ├── AuthService.ts             ← login, register, refresh token issuance/validation
│   ├── ChatService.ts             ← message send/stream, chat CRUD, RAG injection
│   ├── ModelService.ts            ← ← NEW: ai_models CRUD (extracted from route)
│   ├── AgentService.ts            ← ← NEW: agents CRUD (extracted from route)
│   ├── ToolService.ts             ← ← NEW: tools CRUD (extracted from route)
│   ├── KnowledgeService.ts        ← knowledge store + document management, retrieve()
│   ├── WebhookService.ts          ← webhook CRUD (rename methods to createWebhook, etc.)
│   ├── McpService.ts              ← MCP connection management + tool invocation
│   └── SharingService.ts          ← resource sharing + access control queries
└── modules/
    ├── ModelProvider/
    │   ├── ModelProviderBase.ts   ← abstract class with abstract chat(), stream(), etc.
    │   ├── OpenAIProvider.ts
    │   ├── AnthropicProvider.ts
    │   ├── OllamaProvider.ts
    │   ├── GeminiProvider.ts
    │   ├── GroqProvider.ts
    │   ├── AzureProvider.ts
    │   ├── WebhookProvider.ts     ← to be implemented (model type 'webhook')
    │   └── ModelProviderFactory.ts
    ├── EmbeddingProvider/
    │   ├── EmbeddingProviderBase.ts  ← abstract class
    │   ├── OpenAIEmbedding.ts
    │   ├── OllamaEmbedding.ts
    │   ├── HuggingFaceEmbedding.ts
    │   └── EmbeddingProviderFactory.ts  ← ← NEW: extracted from KnowledgeService
    ├── VectorStore/
    │   ├── VectorStoreBase.ts     ← abstract class including useCollection()
    │   ├── LocalVectorStore.ts
    │   ├── ChromaVectorStore.ts
    │   └── VectorStoreFactory.ts
    ├── BinaryProcessor/
    │   ├── BinaryProcessorBase.ts ← abstract class
    │   ├── LangChainProcessor.ts
    │   ├── TikaProcessor.ts
    │   ├── DoclingProcessor.ts
    │   └── BinaryProcessorFactory.ts
    ├── BinaryStorage/
    │   ├── BinaryStorageBase.ts   ← abstract class
    │   └── LocalBinaryStorage.ts
    └── FunctionExecutor/
        ├── FunctionExecutorBase.ts  ← abstract class (already uses abstract execute())
        └── McpFunctionExecutor.ts   ← only executor; Python/TS executors removed
```

---

## 3. Architecture Layers

```
┌─────────────────────────────────────────────────────────┐
│                    HTTP / Socket.IO                       │
│              (app.ts + server.ts)                         │
├─────────────────────────────────────────────────────────┤
│                  Middleware Stack                          │
│   helmet → cors → json → morgan → requireAuth (global)   │
│   → service injection (req.services)                      │
├─────────────────────────────────────────────────────────┤
│                    Route Handlers                          │
│  (validate input, check resource ownership, delegate)     │
├─────────────────────────────────────────────────────────┤
│                   Service Layer                            │
│  All business logic lives here (no DB calls in routes)   │
├─────────────────────────────────────────────────────────┤
│              Module System (Providers/Factories)           │
│  ModelProvider | EmbeddingProvider | VectorStore |        │
│  BinaryProcessor | BinaryStorage | FunctionExecutor       │
├─────────────────────────────────────────────────────────┤
│              DeltaDatabaseAdapter (DB client)             │
│  One class; all HTTP calls to DeltaDB go through here    │
└─────────────────────────────────────────────────────────┘
```

**Rules:**

- Routes call services only — never `getAdapter()` directly
- Services call modules (factories/base classes) and the DB adapter
- Modules have no knowledge of routes, services, or Express
- Config values flow through `config/index.ts` only (no `process.env` scattered in modules)

---

## 4. Module System

All module families follow the same pattern:

```
ModuleNameBase.ts      ← abstract class with abstract method declarations
SpecificImpl.ts        ← extends Base, implements all abstract methods
ModuleNameFactory.ts   ← createFromConfig(config): BaseType function
```

### Abstract Base Pattern (target)

```ts
// ✅ Correct — compiler enforces all methods are implemented
export abstract class ModelProviderBase {
  abstract chat(messages: ModelChatMessage[], opts?: ModelOptions): Promise<ChatResult>
  abstract stream(
    messages: ModelChatMessage[],
    opts: ModelOptions,
    onChunk: (c: string) => void,
  ): Promise<ChatResult>
  abstract supportsTools(): boolean
}
```

```ts
// ❌ To be removed — runtime-only enforcement
async chat(...): Promise<ChatResult> {
  throw new Error(`${this.constructor.name} must implement chat()`)
}
```

### Provider Families

| Family            | Base Class              | Factory                              | Implementations                                             |
| ----------------- | ----------------------- | ------------------------------------ | ----------------------------------------------------------- |
| ModelProvider     | `ModelProviderBase`     | `ModelProviderFactory`               | OpenAI, Anthropic, Ollama, Gemini, Groq, Azure, **Webhook** |
| EmbeddingProvider | `EmbeddingProviderBase` | `EmbeddingProviderFactory` (**new**) | OpenAI, Ollama, HuggingFace                                 |
| VectorStore       | `VectorStoreBase`       | `VectorStoreFactory`                 | Local, Chroma                                               |
| BinaryProcessor   | `BinaryProcessorBase`   | `BinaryProcessorFactory`             | LangChain, Tika, Docling                                    |
| BinaryStorage     | `BinaryStorageBase`     | —                                    | Local                                                       |
| FunctionExecutor  | `FunctionExecutorBase`  | —                                    | McpFunctionExecutor                                         |

### `VectorStoreBase` Must Include `useCollection()`

```ts
export abstract class VectorStoreBase {
  abstract useCollection(name: string): Promise<void>
  abstract upsert(id: string, vector: number[], metadata: Record<string, unknown>): Promise<void>
  abstract query(vector: number[], topK: number): Promise<VectorSearchResult[]>
  abstract delete(id: string): Promise<void>
  abstract deleteCollection(name: string): Promise<void>
}
```

### WebhookProvider Implementation (planned)

`WebhookProvider` wraps an external HTTP endpoint as a model provider. It:

- Posts the message array to the configured `url` as JSON
- Streams the response if the endpoint supports SSE / chunked transfer
- Handles both streaming (`stream()`) and one-shot (`chat()`) modes
- Falls back to non-streaming if the webhook does not support it

---

## 5. Service Layer Specification

### Naming Convention — All Services

Every service method follows the `verbNoun()` pattern:

| Operation   | Method name        |
| ----------- | ------------------ |
| Create      | `create{Entity}()` |
| Read single | `get{Entity}()`    |
| Read list   | `list{Entities}()` |
| Update      | `update{Entity}()` |
| Delete      | `delete{Entity}()` |

**Current violations to fix:**

- `WebhookService.register()` → `createWebhook()`
- `WebhookService.get()` → `getWebhook()`
- `WebhookService.delete()` → `deleteWebhook()`
- `AuthService._sanitizeUser()` → `sanitizeUser()` (remove leading underscore; this is public API)

### New Services Required

#### `ModelService.ts`

Extracted from `routes/models.ts`. Responsibilities:

- `listModels(userId, isAdmin)` — with sharing filter
- `getModel(id)` — raw fetch
- `createModel(data)` — validate + persist with `ownerId`
- `updateModel(id, data)` — validate ownership before update
- `deleteModel(id)` — cascade: update chats that reference this modelId

#### `AgentService.ts`

Extracted from `routes/agents.ts`. Same CRUD pattern as ModelService.

#### `ToolService.ts`

Extracted from `routes/tools.ts`. Only MCP tools. Python/TypeScript tool creation is **disabled** (guarded at route level for admin-only, and the executors are not registered).

### `KnowledgeService` — Fix `createKnowledgeStore()`

Must persist `ownerId`:

```ts
async createKnowledgeStore(data: Record<string, unknown>): Promise<Entity> {
  const doc = {
    name: data['name'] as string,
    description: (data['description'] as string | null) ?? null,
    ownerId: (data['ownerId'] as string | null) ?? null,  // ← CURRENTLY MISSING
    embeddingModelId: (data['embeddingModelId'] as string | null) ?? null,
    vectorStoreConfig: (data['vectorStoreConfig'] as object | null) ?? null,
    documentProcessorConfig: (data['documentProcessorConfig'] as object | null) ?? null,
    chunkSize: (data['chunkSize'] as number | null) ?? 1000,
    chunkOverlap: (data['chunkOverlap'] as number | null) ?? 100,
    metadata: {},
  }
  return this._db.createKnowledgeStore(doc)
}
```

### Service Singletons vs Per-Request Instantiation

HTTP path (`routes/index.ts`): create service singletons at module-load time, inject via middleware. ✅

WebSocket path (`server.ts`): **must** reuse the same service singletons — currently creates new instances per `chat:send` event. Fix: import the shared instances from `routes/index.ts` or extract to a shared `createServices.ts` module.

---

## 6. API Routes

### REST Semantics Fixes

| Current                   | Should Be                | Reason         |
| ------------------------- | ------------------------ | -------------- |
| `POST /api/mcp/tools`     | `GET /api/mcp/tools`     | Read-only list |
| `POST /api/mcp/resources` | `GET /api/mcp/resources` | Read-only list |
| `POST /api/mcp/prompts`   | `GET /api/mcp/prompts`   | Read-only list |

### Missing Routes to Add

| Route                | Method | Purpose                                   |
| -------------------- | ------ | ----------------------------------------- |
| `/api/knowledge/:id` | `PUT`  | Update store name, description, config    |
| `/api/auth/refresh`  | `POST` | Issue new access token from refresh token |
| `/api/auth/logout`   | `POST` | Invalidate refresh token                  |

### Auth Guards — Canonical State

| Route Group               | Public | `requireAuth`            | `requireAdmin`          |
| ------------------------- | ------ | ------------------------ | ----------------------- |
| `POST /api/auth/login`    | ✅     | —                        | —                       |
| `POST /api/auth/register` | ✅     | —                        | —                       |
| `POST /api/auth/refresh`  | ✅     | —                        | —                       |
| `GET /api/settings`       | —      | —                        | ✅ (add `requireAdmin`) |
| `PUT /api/settings`       | —      | —                        | ✅                      |
| `POST /api/tools`         | —      | ✅                       | ✅ (MCP tool creation)  |
| `PUT /api/tools/:id`      | —      | ✅                       | ✅                      |
| `GET /api/tools`          | —      | ✅                       | —                       |
| `GET /api/models/*`       | —      | ✅ + ownership           | —                       |
| `GET /api/knowledge/:id`  | —      | ✅ + sharing check       | —                       |
| `GET /api/providers`      | —      | ✅ (admin only for URLs) | —                       |
| All other CRUD            | —      | ✅                       | —                       |

### Ownership Check Pattern

All `GET /:id`, `PUT /:id`, `DELETE /:id` endpoints on user-owned resources must follow:

```ts
router.get('/:id', requireAuth, async (req, res, next) => {
  try {
    const resource = await service.getX(req.params.id)
    if (!resource) return res.status(404).json({ error: 'Not found' })
    const canAccess =
      req.user!.role === 'admin' ||
      resource['ownerId'] === req.user!.id ||
      (await sharingService.canAccess(req.user!.id, 'resource_type', req.params.id))
    if (!canAccess) return res.status(403).json({ error: 'Access denied' })
    res.json(resource)
  } catch (err) {
    next(err)
  }
})
```

### 404 Response Format

Always: `res.status(404).json({ error: 'Not found' })` — never reflect the request URL.

---

## 7. Authentication & Authorization

### Target Auth Architecture: Access Token + Refresh Token

```
POST /api/auth/login
  → validates credentials
  → issues: accessToken (15 min, JWT) + refreshToken (7 days, opaque, stored in DB)
  → accessToken: returned in JSON body (stored in memory / short-lived cookie)
  → refreshToken: set as HttpOnly Secure SameSite=Strict cookie

POST /api/auth/refresh
  → reads refreshToken from HttpOnly cookie
  → validates against DB (checks not revoked)
  → issues new accessToken (15 min)
  → rotates refreshToken (invalidates old, issues new)

POST /api/auth/logout
  → deletes refreshToken from DB
  → clears cookie

requireAuth middleware
  → reads Authorization: Bearer <accessToken>
  → verifies JWT signature + expiry
  → attaches req.user
```

### Refresh Token Storage (Backend)

```ts
// schema: refresh_tokens collection
{
  id: string // the opaque token value (random 64 bytes, hex-encoded)
  userId: string
  expiresAt: number // unix timestamp
  revokedAt: number | null
  createdAt: number
}
```

### Startup Validation

```ts
// config/index.ts
const requiredSecrets = ['JWT_SECRET', 'WEBHOOK_SECRET']
if (process.env['NODE_ENV'] === 'production') {
  for (const key of requiredSecrets) {
    if (!process.env[key]) throw new Error(`${key} must be set in production`)
  }
}
```

### Rate Limiting (Auth Endpoints)

```ts
// app.ts — apply before routes
app.use('/api/auth/login', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }))
app.use('/api/auth/register', rateLimit({ windowMs: 60 * 60 * 1000, max: 5 }))
app.use('/api/auth/google', rateLimit({ windowMs: 15 * 60 * 1000, max: 20 }))
```

### Multi-Tenancy Model: Team-Aware Resource Ownership

Every user-owned entity stores `ownerId`. Sharing is explicit: a user or group is granted access to a specific resource via the `sharing.ts` / `SharingService`.

```
User A creates a knowledge store → ownerId = User A's id
User A shares it with User B    → SharingService records (resourceType, resourceId, userId)
User B can now read it          → SharingService.canAccess() returns true
Admin can access everything     → role check bypasses ownership filter
```

**Entities that must have `ownerId`:**

- `chats` ✅
- `knowledge_stores` — **bug: ownerId currently not persisted** (see BC-2 in report.md)
- `ai_models` ✅
- `agents` ✅
- `tools` ✅
- `webhooks` — **missing: no ownerId in schema** (see BH-2 in report.md)

---

## 8. Database Layer

### Collections & Schemas

All schemas defined in `backend/src/db/schema.ts`. All DB I/O goes through `DeltaDatabaseAdapter`.

#### Schema Cleanup Required

| Issue                                                    | Action                                                            |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| `chats.model` + `chats.modelId` — two overlapping fields | Deprecate `model` (free-text name); use only `modelId` (UUID ref) |
| `knowledge_stores.embeddingModel` — never read           | Remove from schema; keep only `embeddingModelId`                  |
| `webhooks` — no `ownerId`                                | Add `ownerId: 'string\|null'` to schema                           |

#### Secondary Indexes Required

Add secondary indexes for login-path queries:

```ts
// Currently: full table scan on every login
await db.createCollection('users', schema, ['email', 'googleId'])
// Then query: await db.findBy('users', 'email', emailValue)
```

### Database Adapter Conventions

- All methods return `null` (not throw) when a record is not found
- Adaptor never calls services — pure data access only
- All writes go through schema validation before sending to DeltaDB

---

## 9. Configuration

`backend/src/config/index.ts` is the **single source of truth** for all configuration. No `process.env` access outside this file.

### Required at Startup (must not have defaults in production)

```
JWT_SECRET              Random 256-bit string
WEBHOOK_SECRET          Random 256-bit string
DELTADB_URL             DeltaDatabase base URL
DELTADB_ADMIN_KEY       DeltaDatabase admin API key
DELTADB_DATABASE        Database name
```

### Optional with Defaults

```
PORT                    3001
CORS_ORIGINS            (must be set explicitly in production — no localhost default)
JWT_EXPIRES_IN          15m (access token)
JWT_REFRESH_EXPIRES_IN  7d (refresh token)

# Providers (all optional — feature disabled if not set)
OPENAI_API_KEY          ...
ANTHROPIC_API_KEY       ...
GEMINI_API_KEY          ...
GROQ_API_KEY            ...
AZURE_OPENAI_API_KEY    ...
AZURE_OPENAI_ENDPOINT   ...
OLLAMA_BASE_URL         http://localhost:11434

# External services
CHROMA_URL              http://localhost:8000
TIKA_URL                http://localhost:9998
DOCLING_URL             http://localhost:5001
MCP_SERVER_URL          (optional)

# SCIM
SCIM_API_TOKEN          (required if SCIM integration is used)
```

---

## 10. Consistency Rules

These rules define what "consistent code" looks like across the backend. All new code and all fixes to existing code must follow them.

### 1 · Route ↔ Service Separation

- Routes: parse/validate input → ownership check → call service → send response
- Services: business logic, orchestration, module calls, DB writes
- No `getAdapter()` calls in routes

### 2 · Error Response Format

All error responses:

```json
{ "error": "Human-readable message" }
```

Never include stack traces, internal paths, or request URL reflections.

### 3 · HTTP Status Codes

| Situation                        | Code |
| -------------------------------- | ---- |
| Not found                        | 404  |
| Unauthorized (not logged in)     | 401  |
| Forbidden (logged in, no access) | 403  |
| Validation error                 | 400  |
| Success with body                | 200  |
| Created                          | 201  |
| Deleted                          | 204  |

### 4 · Module Pattern

Every module family has Base → Implementation → Factory.
Base classes use TypeScript `abstract` methods.
Factories are the only place `new ConcreteImpl()` is called.

### 5 · Service Naming

All CRUD methods: `createX`, `getX`, `listX`, `updateX`, `deleteX`.

### 6 · Config Access

Only `import { config } from '../config'` — never `process.env` directly in modules or services.

### 7 · Tool Safety

Only MCP tools are registered and executed. Python/TypeScript tool creation is blocked at the route level (`requireAdmin` + runtime check on `tool.type`). The `PythonSandboxExecutor` and `TypeScriptSandboxExecutor` are removed or left dormant.

### 8 · SSRF Prevention

Any code that makes outbound HTTP requests based on user-supplied URLs (webhooks, MCP connections) must validate the URL through the `isAllowedExternalUrl()` utility before making the request.
