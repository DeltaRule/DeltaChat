# DeltaDatabase Feedback

Issues, limitations, and observations discovered while integrating
[DeltaDatabase](https://github.com/DeltaRule/DeltaDatabase) as the sole storage
backend for DeltaChat.  Each item includes the symptom, root cause (pre- or
post-spec), resolution status, and any remaining recommendation.

The full OpenAPI 3.0.3 spec is saved at [`docs/openapi.yaml`](docs/openapi.yaml).

---

## 1. No native "list all" operation

**Status: Unresolved — adapter workaround in place**

**Symptom**  
There is no endpoint to retrieve all documents in a collection.

**Root cause**  
DeltaDatabase is a pure key→value store.  The only read endpoint is
`GET /entity/{db}?key={k}` (single key lookup); there is no scan or range query.

**Mitigation**  
The adapter maintains explicit index documents alongside the data:

| Index key | Purpose |
|---|---|
| `{col}:_index` | Ordered list of all active entity IDs in a collection |
| `{col}:_idx:{field}:{value}` | Secondary index: IDs where `doc[field] === value` |

Every `insert` updates both indexes; every `delete` prunes them.
This adds **2–3 extra round-trips** per write.

**Recommendation**  
DeltaDatabase should expose a `GET /entity/{db}/keys` or cursor-based scan
endpoint to retrieve all keys efficiently without client-managed indexes.

---

## 2. No atomic transactions

**Status: Unresolved — no mitigation available**

**Symptom**  
An insert requires (a) storing the entity, then (b) updating the master index,
then (c) updating any secondary indexes.  If the process crashes between steps,
the data is left in an inconsistent state.

**Root cause**  
DeltaDatabase offers no multi-key atomic write.  Each `PUT /entity/{db}` is an
independent HTTP request.

**Mitigation**  
None available within the current API surface.  The adapter performs each step
sequentially; a mid-sequence failure will produce phantom index entries or
orphaned entity documents.

**Recommendation**  
DeltaDatabase should expose a batched/atomic PUT that accepts multiple key-value
pairs and commits them all or none.

---

## 3. Auth model was wrong — now corrected per OpenAPI spec

**Status: Resolved ✓**

**Previous symptom (now fixed)**  
The original adapter called `POST /api/login` to exchange the admin key for a
short-lived session token, then used that token as the Bearer value.  The token
was cached and refreshed before expiry.  The `_authHeader()` helper also had a
corrupted template literal (`Bearer this._ensureToken()}` instead of
`Bearer ${await this._ensureToken()}`), which would have sent a literal string
as the header value.

**Root cause (confirmed by OpenAPI spec)**  
The spec states explicitly:

> **For all server-to-server and script usage**, supply an admin key or API key
> directly as the Bearer value on every request.  No login step is needed and
> no token ever needs to be refreshed.

`POST /api/login` exists **only** for the built-in browser UI (exchanges a key
for a short-lived 24 h session token to avoid storing raw keys in browser
storage).  Session tokens cannot be refreshed — the browser calls
`POST /api/login` again when one expires.

**Resolution**  
The adapter now uses `_authHeader()` as a synchronous method that returns
`{ Authorization: Bearer ${this.apiKey} }` directly.  The `_ensureToken()`,
`_token`, `_tokenExpiry`, and `TOKEN_REFRESH_MARGIN_MS` code has been removed
entirely.  `POST /api/login` is never called.

**What `client_id` login means**  
`{ client_id: "…" }` in the login body is confirmed as dev-mode only — accepted
for backwards compatibility when the server is started without `-admin-key`.
It is not a general-purpose auth path.

---

## 4. Real entity DELETE endpoint exists — soft-delete was unnecessary

**Status: Resolved ✓**

**Previous symptom (now fixed)**  
The adapter performed soft-deletes: it PUT the entity back with `_deleted: true`
and relied on all read paths filtering that field out.  This left tombstone
documents occupying space forever.

**Root cause**  
The `DELETE /entity/{database}?key={key}` endpoint was not known to be available.

**Resolution confirmed by OpenAPI spec**  
```
DELETE /entity/{database}?key={key}   →  200 { status: 'ok' }
```
Requires `write` permission.  The adapter's `_deleteEntity(key)` method now
calls this endpoint.  The `delete()` CRUD method hard-deletes the entity and
then prunes the index documents.  No tombstones are left behind.

---

## 5. Token expiry field — issue no longer exists

**Status: Resolved ✓ (no longer relevant)**

The concern was that `data.expires_at` from the login response might not match
the actual field name, silently breaking token expiry tracking.  Since the
adapter no longer calls `POST /api/login` or tracks tokens at all, this issue
is moot.  The `LoginResponse` schema in the OpenAPI spec does confirm the field
is named `expires_at`.

---

## 6. Schema IDs are global, not per-database

**Status: Unresolved — recommendation pending**

**Symptom**  
`PUT /schema/{schemaID}` and `GET /schema/{schemaID}` operate at the instance
level, not scoped to a specific database namespace.  Schema IDs such as `chats`
and `messages` are shared across all tenants on the same DeltaDatabase instance.

**Root cause confirmed by OpenAPI spec**  
The spec path is `/schema/{schemaID}` with no database component.
`GET /admin/schemas` returns all schema IDs globally.

**Mitigation**  
For single-tenant deployments this is not a problem.  For multi-tenant
deployments, operators should use namespaced schema IDs (e.g. `deltachat.chats`).

**Recommendation**  
DeltaDatabase should support per-database schema namespacing, or document the
global scope clearly so operators can plan IDs accordingly.

---

## 7. Index documents live in the same database namespace as entity data

**Status: Unresolved — design limitation**

**Symptom**  
Index documents (`chats:_index`, `messages:_idx:chatId:abc`) live in the same
database as real entity documents.  If DeltaDatabase applies collection-level
schema validation to all keys with a given prefix, index documents (different
shape) would fail validation.

**Mitigation**  
The registered JSON Schemas are intentionally permissive
(`additionalProperties` not restricted) so index documents pass validation.
The colon-delimited naming convention (`{col}:_index`, `{col}:_idx:…`) makes
index keys visually distinct from entity keys (`{col}:{uuid}`).

**Recommendation**  
DeltaDatabase should provide a reserved system namespace or a way to opt
individual keys out of schema validation.

---

## 8. No schema enforcement confirmation from the API

**Status: Unresolved — recommendation pending**

**Symptom**  
After a successful `PUT /schema/{schemaID}`, there is no observable side-effect
confirming that DeltaDatabase is actively validating entities against the schema.
The spec documents the endpoint but does not state whether validation is enforced
at write time or is advisory only.

**Mitigation**  
The adapter's `registerSchemas()` verifies the round-trip by calling
`GET /schema/{schemaID}` after each `PUT` and checking that the stored `$id`
matches.  `initialize()` also calls `GET /admin/schemas` to log all registered
schema IDs.  This confirms schemas are persisted but not that they are enforced.

**Recommendation**  
DeltaDatabase should document whether `PUT /schema/{schemaID}` enables
write-time JSON Schema validation, and add a `"enforced": true/false` flag to
the stored schema response or `GET /admin/schemas` output.

---

## 9. Dead code: `updateSettings` insert branch is unreachable

**Status: Documented — harmless but confusing**

**Symptom**  
`DeltaDatabaseAdapter.updateSettings()` contains a branch that calls
`this._backend.insert(...)`.  It can never be reached because `getSettings()`
always returns at least `{ id: 'global' }` as a fallback, which satisfies the
`existing && existing.id` guard and always takes the `update` path.

**Root cause**  
The defensive fallback in `getSettings()` returns a non-null object even when no
settings document exists in the database.  The `updateSettings` logic was written
assuming `getSettings` could return null.

**Mitigation**  
Documented and asserted in the test suite.

**Recommendation**  
Remove the `insert` branch from `updateSettings()`, or change `getSettings()` to
return `null` when no settings document exists.

---

## 10. No DeltaDatabase health check before schema registration

**Status: Mitigated for Docker Compose**

**Symptom**  
`initialize()` is invoked in the `server.listen` callback immediately after the
server starts accepting connections.  If DeltaDatabase is not yet ready,
schema registration fails and the error is only logged, not retried.

**Mitigation**  
The `docker-compose.yml` includes a `healthcheck` for the `deltadatabase`
service and `depends_on: condition: service_healthy` in the backend service.
For non-Docker deployments this protection is absent.

**Recommendation**  
Add a retry loop with exponential back-off in `initialize()` so schema
registration is retried automatically when DeltaDatabase is temporarily
unavailable at startup.

---

## 11. Env var naming inconsistency between Node.js adapter and Python example

**Status: Resolved ✓**

**Symptom**  
The Python example in the problem statement uses `DELTA_DB_API_KEY`, while the
Node.js adapter previously used `DELTA_DB_ADMIN_KEY`.

**Resolution**  
`config/index.js` now reads `DELTA_DB_API_KEY` first and falls back to
`DELTA_DB_ADMIN_KEY` for backwards compatibility.  `.env.example` and
`docker-compose.yml` are updated to use `DELTA_DB_API_KEY`.

---

## 12. `GET /admin/schemas` available as a schema inventory check

**Status: Implemented ✓**

**Discovery**  
The OpenAPI spec documents `GET /admin/schemas` (no auth required) which returns
an array of all registered schema IDs.

**Implementation**  
`DeltaDatabaseClient.listSchemas()` calls this endpoint.
`DeltaDatabaseAdapter.initialize()` calls it after `registerSchemas()` and logs
the full list of active schema IDs on the server, providing an immediate
post-startup confirmation of which schemas are registered.


Issues, limitations, and observations discovered while integrating
[DeltaDatabase](https://github.com/DeltaRule/DeltaDatabase) as the sole storage
backend for DeltaChat.  Each item includes the symptom, root cause, and how it
was mitigated (or not) in this codebase.

---

## 1. No native "list all" or "delete" operations

**Symptom**  
There is no endpoint to retrieve all documents in a collection or to remove a
document by key.

**Root cause**  
DeltaDatabase is a pure key→value store.  The only read endpoint is
`GET /entity/{db}?key={k}` (single key lookup); there is no scan or range query.

**Mitigation**  
The adapter maintains explicit index documents alongside the data:

| Index key | Purpose |
|---|---|
| `{col}:_index` | Ordered list of all active entity IDs in a collection |
| `{col}:_idx:{field}:{value}` | Secondary index: IDs where `doc[field] === value` |

Every `insert` updates both indexes; every `delete` prunes them.
This adds **2–3 extra round-trips** per write and requires careful ordering to
avoid leaving stale index entries on partial failures (see item 2).

---

## 2. No atomic transactions

**Symptom**  
An insert requires (a) storing the entity, then (b) updating the master index,
then (c) updating any secondary indexes.  If the process crashes between steps,
the data is left in an inconsistent state.

**Root cause**  
DeltaDatabase offers no multi-key atomic write.  Each `PUT /entity/{db}` is an
independent HTTP request.

**Mitigation**  
None available within the current API surface.  The adapter performs each step
sequentially and logs errors, but a mid-sequence failure will produce phantom
index entries or orphaned entity documents.

**Recommendation**  
DeltaDatabase should expose a batched/atomic PUT that accepts multiple key-value
pairs and commits them all or none.

---

## 3. Schema endpoint requires write permission but documentation is vague

**Symptom**  
`PUT /schema/{schemaID}` is documented as "requires write permission" without
specifying which token grants that permission (admin key vs. client token).

**Root cause**  
The DeltaDatabase documentation does not clearly distinguish write-permission
levels for the schema API vs. the entity API.

**Mitigation**  
The adapter uses the admin key (Bearer token obtained via `POST /api/login` with
`{ key: adminKey }`) for schema registration.  This works in practice but is
undocumented.

**Recommendation**  
Document explicitly that schema registration requires an admin-key-derived token.

---

## 4. Login body format inconsistency

**Symptom**  
The DeltaDatabase example application (Flask) uses `{ client_id: "chat-app" }`
for login, while the admin key flow uses `{ key: adminKey }`.  The two formats
target different authentication paths but share the same endpoint.

**Root cause**  
The `/api/login` endpoint appears to accept two mutually exclusive body schemas
with no discriminator field other than which key is present.

**Mitigation**  
The adapter checks whether `DELTA_DB_ADMIN_KEY` is set:
- If set → `POST /api/login { key: adminKey }`
- If not set → `POST /api/login { client_id: "deltachat" }`

**Recommendation**  
DeltaDatabase should document both login modes with explicit examples and
describe what permissions each grants.

---

## 5. Token expiry field name is unverified

**Symptom**  
The adapter reads `data.expires_at` from the login response to pre-emptively
refresh the token before it expires.  If DeltaDatabase uses a different field
name (e.g. `expiresAt`, `exp`, or omits it entirely), the expiry tracking is
silently broken and `_tokenExpiry` stays `null`, falling back to infinite reuse
until a 401 occurs.

**Root cause**  
The DeltaDatabase API response for `POST /api/login` is not fully documented.

**Mitigation**  
The adapter handles `null` expiry gracefully; a 401 on any request triggers a
single token refresh and retry, so functionality is never blocked.

**Recommendation**  
Document the exact JSON response shape for `POST /api/login`, including the
token expiry field name and format.

---

## 6. Schema IDs are global, not per-database

**Symptom**  
`PUT /schema/{schemaID}` registers a schema globally (not scoped to a database
namespace).  Schema IDs like `chats`, `messages`, etc. are therefore shared
across all DeltaDatabase tenants on the same instance.

**Root cause**  
The schema endpoint path is `/schema/{schemaID}`, not
`/schema/{database}/{schemaID}`.

**Mitigation**  
For single-tenant deployments (the common case) this is not a problem.  For
multi-tenant deployments, operators should use unique, namespaced schema IDs
(e.g. `deltachat.chats`) to avoid conflicts.  This codebase uses short IDs
(`chats`, `messages`, …) which could conflict if the instance is shared.

**Recommendation**  
DeltaDatabase should support per-database schema namespacing, or document the
global scope clearly so operators can design IDs accordingly.

---

## 7. Index documents stored in the same namespace as entity data

**Symptom**  
Index documents (`chats:_index`, `messages:_idx:chatId:abc123`) live in the
same database namespace as real entity documents.  If DeltaDatabase ever applies
a collection-level schema to all keys in a namespace, the index documents
(which have a different shape) will fail validation.

**Root cause**  
There is no separate "metadata" or "system" namespace available.

**Mitigation**  
The adapter uses a colon-delimited naming convention for index keys
(`{col}:_index`, `{col}:_idx:…`) which is visually distinct from entity keys
(`{col}:{uuid}`), but they are all stored under the same database.
The registered JSON Schemas are intentionally permissive (`additionalProperties`
is not restricted) so index documents are not rejected.

**Recommendation**  
DeltaDatabase should provide a reserved namespace for system/index metadata, or
offer a way to opt individual keys out of schema validation.

---

## 8. No schema enforcement confirmation from the API

**Symptom**  
After a successful `PUT /schema/{schemaID}`, there is no observable side-effect
that confirms DeltaDatabase is actively validating entities against the schema.
If the server stores the schema document but does not enforce it, invalid data
can still be written silently.

**Root cause**  
The DeltaDatabase documentation does not state whether schema registration is
enforced (write-time validation) or advisory (documentation only).

**Mitigation**  
The adapter's `registerSchemas()` verifies the round-trip by calling
`GET /schema/{schemaID}` after each `PUT` and checking that the stored `$id`
matches.  This confirms the schema was persisted, but does **not** confirm
validation is enforced.

**Recommendation**  
DeltaDatabase should document whether `PUT /schema/{schemaID}` enables
write-time JSON Schema validation, and ideally add a `"enforced": true/false`
flag to the stored schema response.

---

## 9. Dead code: `updateSettings` insert branch is unreachable

**Symptom**  
`DeltaDatabaseAdapter.updateSettings()` contains an `else` branch that calls
`this._backend.insert(...)`.  This branch can never be reached because
`getSettings()` always returns at least `{ id: 'global' }` as a fallback, which
satisfies the `existing && existing.id` guard and always takes the `update` path.

**Root cause**  
The defensive fallback in `getSettings()` returns a non-null object even when the
settings document does not exist in the database.  The `updateSettings` logic was
written assuming `getSettings` could return a null/empty value.

**Mitigation**  
Documented in the test suite
(`updateSettings() always calls update because getSettings fallback always has id`).
The dead branch is harmless but could be confusing.

**Recommendation**  
Remove the `insert` branch from `updateSettings()`, or change `getSettings()` to
return `null` when no settings document exists so that `updateSettings` can
correctly `insert` on first use.

---

## 10. No DeltaDatabase health check before schema registration

**Symptom**  
`initialize()` (which calls `registerSchemas()`) is invoked in the `server.listen`
callback immediately after the server starts accepting connections.  If
DeltaDatabase is not yet ready (e.g., still starting up in Docker Compose without
a proper health check), schema registration fails and the error is only logged,
not retried.

**Root cause**  
There is no built-in readiness probe or retry loop before calling
`registerSchemas()`.

**Mitigation**  
The `docker-compose.yml` includes a `healthcheck` for the `deltadatabase` service
and `depends_on: condition: service_healthy` in the backend service, so in
Docker Compose deployments the backend only starts after DeltaDatabase is ready.
For non-Docker deployments this protection is absent.

**Recommendation**  
Add a retry loop with exponential back-off in `initialize()` so schema
registration is retried automatically when DeltaDatabase is temporarily
unavailable at startup.
