'use strict'

export interface SchemaDefinition {
  required: string[]
  fields: Record<string, string>
}

export const SCHEMAS: Record<string, SchemaDefinition> = {
  chats: {
    required: ['id', 'title'],
    fields: {
      id: 'string',
      title: 'string',
      model: 'string|null',
      modelId: 'string|null',
      folder: 'string|null',
      bookmarked: 'boolean',
      systemPrompt: 'string|null',
      knowledgeStoreIds: 'Array<string>',
      webhookId: 'string|null',
      ownerId: 'string|null',
      metadata: 'object',
      createdAt: 'string (ISO 8601)',
      updatedAt: 'string (ISO 8601)',
    },
  },
  messages: {
    required: ['id', 'chatId', 'role', 'content'],
    fields: {
      id: 'string',
      chatId: 'string',
      role: '"user"|"assistant"|"system"',
      content: 'string',
      model: 'string|null',
      usage: 'object|null',
      sources: 'Array<object>|null',
      createdAt: 'string (ISO 8601)',
      updatedAt: 'string (ISO 8601)',
    },
  },
  knowledge_stores: {
    required: ['id', 'name'],
    fields: {
      id: 'string',
      name: 'string',
      description: 'string',
      embeddingModel: 'string|null',
      embeddingModelId: 'string|null',
      vectorStoreConfig: 'object|null',
      documentProcessorConfig: 'object|null',
      chunkSize: 'number|null',
      chunkOverlap: 'number|null',
      chunkUnit: 'string|null',
      ownerId: 'string|null',
      metadata: 'object',
      createdAt: 'string (ISO 8601)',
      updatedAt: 'string (ISO 8601)',
    },
  },
  documents: {
    required: ['id', 'knowledgeStoreId', 'filename'],
    fields: {
      id: 'string',
      knowledgeStoreId: 'string',
      filename: 'string',
      mimeType: 'string',
      size: 'number',
      chunkCount: 'number',
      status: '"processing"|"indexed"|"error"',
      processorMeta: 'object',
      errorMessage: 'string|null',
      createdAt: 'string (ISO 8601)',
      updatedAt: 'string (ISO 8601)',
    },
  },
  webhooks: {
    required: ['id', 'name', 'url'],
    fields: {
      id: 'string',
      name: 'string',
      url: 'string',
      events: 'Array<string>',
      chatIds: 'Array<string>',
      headers: 'object',
      secret: 'string|null',
      enabled: 'boolean',
      createdAt: 'string (ISO 8601)',
      updatedAt: 'string (ISO 8601)',
    },
  },
  users: {
    required: ['id', 'email', 'name', 'role'],
    fields: {
      id: 'string',
      email: 'string',
      name: 'string',
      picture: 'string|null',
      role: '"admin"|"user"',
      passwordHash: 'string|null',
      googleId: 'string|null',
      disabled: 'boolean',
      createdAt: 'string (ISO 8601)',
      updatedAt: 'string (ISO 8601)',
    },
  },
  user_groups: {
    required: ['id', 'name'],
    fields: {
      id: 'string',
      name: 'string',
      description: 'string|null',
      memberIds: 'Array<string>',
      externalId: 'string|null',
      metadata: 'object',
      createdAt: 'string (ISO 8601)',
      updatedAt: 'string (ISO 8601)',
    },
  },
  resource_shares: {
    required: ['id', 'resourceType', 'resourceId', 'targetType', 'targetId', 'sharedById'],
    fields: {
      id: 'string',
      resourceType: '"knowledge_store"|"ai_model"|"agent"|"tool"',
      resourceId: 'string',
      targetType: '"user"|"group"',
      targetId: 'string',
      sharedById: 'string',
      createdAt: 'string (ISO 8601)',
    },
  },
  settings: {
    required: ['id'],
    fields: { id: '"global"' },
  },
  ai_models: {
    required: ['id', 'name'],
    fields: {
      id: 'string',
      name: 'string',
      description: 'string|null',
      type: '"model"|"webhook"|"agent"|"embedding"',
      provider: 'string|null',
      providerModel: 'string|null',
      systemPrompt: 'string|null',
      temperature: 'number|null',
      maxTokens: 'number|null',
      knowledgeStoreIds: 'Array<string>',
      toolIds: 'Array<string>',
      webhookId: 'string|null',
      agentId: 'string|null',
      enabled: 'boolean',
      ownerId: 'string|null',
      createdAt: 'string (ISO 8601)',
      updatedAt: 'string (ISO 8601)',
    },
  },
  agents: {
    required: ['id', 'name'],
    fields: {
      id: 'string',
      name: 'string',
      description: 'string|null',
      systemPrompt: 'string',
      provider: 'string|null',
      providerModel: 'string|null',
      knowledgeStoreIds: 'Array<string>',
      toolIds: 'Array<string>',
      temperature: 'number|null',
      maxTokens: 'number|null',
      ownerId: 'string|null',
      createdAt: 'string (ISO 8601)',
      updatedAt: 'string (ISO 8601)',
    },
  },
  tools: {
    required: ['id', 'name', 'type'],
    fields: {
      id: 'string',
      name: 'string',
      description: 'string|null',
      type: '"mcp"|"python"|"typescript"',
      config: 'object',
      enabled: 'boolean',
      ownerId: 'string|null',
      createdAt: 'string (ISO 8601)',
      updatedAt: 'string (ISO 8601)',
    },
  },
}

export interface AppError extends Error {
  status?: number
}

export function validate(collection: string, doc: Record<string, unknown>): void {
  const schema = SCHEMAS[collection]
  if (!schema) return
  for (const field of schema.required) {
    if (doc[field] === undefined || doc[field] === null) {
      const err: AppError = new Error(
        `[Schema] "${collection}" document is missing required field: "${field}"`,
      )
      err.status = 400
      throw err
    }
  }
}

// ── JSON Schema (draft-07) generation ─────────────────────────────────────

/**
 * Convert a field type string from the SCHEMAS definition into a JSON Schema
 * property definition.
 */
function fieldToJsonSchema(fieldType: string): Record<string, unknown> {
  // Enum: "value1"|"value2"|...
  if (/^"[^"]+"\|"[^"]+"/.test(fieldType.replace(/\s/g, ''))) {
    const values = [...fieldType.matchAll(/"([^"]+)"/g)].map((m) => m[1])
    return { type: 'string', enum: values }
  }
  // Single quoted enum: "global"
  if (/^"[^"]+"$/.test(fieldType.trim())) {
    return { type: 'string', enum: [fieldType.replace(/"/g, '')] }
  }
  // Array<T>
  const arrMatch = fieldType.match(/^Array<(\w+)>(\|null)?$/)
  if (arrMatch) {
    const base: Record<string, unknown> = {
      type: 'array',
      items: { type: arrMatch[1].toLowerCase() },
    }
    if (arrMatch[2]) {
      return { oneOf: [base, { type: 'null' }] }
    }
    return base
  }
  // type|null
  const nullMatch = fieldType.match(/^(\w+)\|null$/)
  if (nullMatch) {
    return { type: [nullMatch[1].toLowerCase(), 'null'] }
  }
  // string (ISO 8601)
  if (fieldType.includes('ISO 8601')) {
    return { type: 'string', format: 'date-time' }
  }
  // Primitive: string, number, boolean, object
  return { type: fieldType.toLowerCase() }
}

/**
 * Build a complete JSON Schema (draft-07) document for a collection.
 * `schemaId` is the full schema_id (e.g. `deltachat.chats`).
 */
export function toJsonSchema(collection: string, schemaId: string): Record<string, unknown> | null {
  const def = SCHEMAS[collection]
  if (!def) return null

  const properties: Record<string, unknown> = {}
  for (const [field, type] of Object.entries(def.fields)) {
    properties[field] = fieldToJsonSchema(type)
  }

  return {
    $schema: 'http://json-schema.org/draft-07/schema#',
    $id: schemaId,
    type: 'object',
    properties,
    required: def.required,
  }
}
