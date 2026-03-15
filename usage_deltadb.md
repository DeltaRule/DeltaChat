### `PUT /entity/{schema_id}`

Create or update one or more entities in the schema-database identified by `schema_id`.
The schema IS the database — `schema_id` serves as both the storage namespace and the
JSON Schema template used for validation (if a template with that ID exists).

**Path parameter:** `schema_id` — schema identifier (e.g., `chat.v1`).

**Request body** — a JSON object where each key is an entity key and each
value is the entity's JSON document:

```json
{
  "session_001": { "messages": [{"role":"user","content":"Hi"}] },
  "session_002": { "messages": [{"role":"user","content":"Hello"}] }
}
```

**Response:**

```json
{ "status": "ok" }
```

---

### `GET /entity/{schema_id}?key={entityKey}`

Retrieve a single entity.

**Path parameter:** `schema_id` — schema identifier.

**Query parameter:** `key` — entity key.

**Response** — the entity's JSON document directly:

```json
{ "messages": [{"role":"user","content":"Hi"}] }
```

**Error responses:**

| HTTP code | Meaning |
|-----------|---------|
| `400` | Missing `key` query parameter or missing schema id |
| `401` | Missing or invalid Bearer token |
| `404` | Entity not found |

---

### `DELETE /entity/{schema_id}?key={entityKey}`

Delete a single entity by key from a schema-database. Requires `write` permission.

**Path parameter:** `schema_id` — schema identifier.

**Query parameter:** `key` — entity key.

**Response:**

```json
{ "status": "ok" }
```

**Error responses:**

| HTTP code | Meaning |
|-----------|---------|
| `400` | Missing `key` query parameter or missing schema id |
| `401` | Missing or invalid Bearer token |
| `403` | Token lacks `write` permission |

---

### `GET /admin/schemas`

Returns a list of all defined schema IDs. No authentication required.

**Response:**

```json
["chat.v1", "user_credentials.v1", "user_chats.v1"]
```

---

### `GET /schema/{schemaID}`

Retrieve the JSON Schema document for a schema ID. No authentication required.

**Path parameter:** `schemaID` — the schema identifier (e.g., `chat.v1`).

**Response** — the raw JSON Schema document:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "chat.v1",
  "type": "object",
  "properties": { "chat": { "type": "array" } },
  "required": ["chat"]
}
```

**Error responses:**

| HTTP code | Meaning |
|-----------|---------|
| `404` | Schema not found |

---

### `PUT /schema/{schemaID}`

Create or replace a JSON Schema. Authentication required.

**Path parameter:** `schemaID` — the schema identifier (e.g., `chat.v1`).

**Request body** — a valid JSON Schema document:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "type": "object",
  "properties": {
    "name": { "type": "string" }
  },
  "required": ["name"]
}
```

**Response:**

```json
{ "status": "ok" }
```

**Error responses:**

| HTTP code | Meaning |
|-----------|---------|
| `400` | Invalid JSON or invalid JSON Schema |
| `401` | Missing or invalid Bearer token |

---

## JSON Schema Templates

DeltaDatabase validates every `PUT` payload against a JSON Schema template
(draft-07) before encryption and storage. Templates are JSON files placed in
`{shared-fs}/templates/`.

### Creating a template on disk

Create `./shared/db/templates/chat.v1.json`:

```json
{
  "$schema": "http://json-schema.org/draft-07/schema#",
  "$id": "chat.v1",
  "type": "object",
  "properties": {
    "messages": {
      "type": "array",
      "items": {
        "type": "object",
        "properties": {
          "role":    { "type": "string", "enum": ["user", "assistant", "system"] },
          "content": { "type": "string" }
        },
        "required": ["role", "content"]
      }
    }
  },
  "required": ["messages"]
}
```

### Creating a template via the REST API (recommended)

Schemas can also be defined directly through the REST API or the web
management UI — no filesystem access required.

```bash
# Save a schema via the API (use admin key directly — no login needed)
ADMIN_KEY=mysecretkey

curl -X PUT http://127.0.0.1:8080/schema/chat.v1 \
  -H "Authorization: Bearer $ADMIN_KEY" \
  -H 'Content-Type: application/json' \
  -d '{
    "$schema": "http://json-schema.org/draft-07/schema#",
    "$id": "chat.v1",
    "type": "object",
    "properties": {
      "messages": { "type": "array" }
    },
    "required": ["messages"]
  }'

# List all schemas
curl http://127.0.0.1:8080/admin/schemas

# Retrieve a schema
curl http://127.0.0.1:8080/schema/chat.v1
```