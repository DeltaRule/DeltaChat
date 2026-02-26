'use strict';

export interface SchemaDefinition {
  required: string[];
  fields: Record<string, string>;
}

export const SCHEMAS: Record<string, SchemaDefinition> = {
  chats: {
    required: ['id', 'title'],
    fields: {
      id: 'string', title: 'string', model: 'string|null',
      systemPrompt: 'string|null', knowledgeStoreIds: 'Array<string>',
      webhookId: 'string|null', metadata: 'object',
      createdAt: 'string (ISO 8601)', updatedAt: 'string (ISO 8601)',
    },
  },
  messages: {
    required: ['id', 'chatId', 'role', 'content'],
    fields: {
      id: 'string', chatId: 'string', role: '"user"|"assistant"|"system"',
      content: 'string', model: 'string|null', usage: 'object|null',
      createdAt: 'string (ISO 8601)', updatedAt: 'string (ISO 8601)',
    },
  },
  knowledge_stores: {
    required: ['id', 'name'],
    fields: {
      id: 'string', name: 'string', description: 'string',
      embeddingModel: 'string|null', metadata: 'object',
      createdAt: 'string (ISO 8601)', updatedAt: 'string (ISO 8601)',
    },
  },
  documents: {
    required: ['id', 'knowledgeStoreId', 'filename'],
    fields: {
      id: 'string', knowledgeStoreId: 'string', filename: 'string',
      mimeType: 'string', size: 'number', chunkCount: 'number',
      status: '"processing"|"indexed"|"error"', processorMeta: 'object',
      errorMessage: 'string|null',
      createdAt: 'string (ISO 8601)', updatedAt: 'string (ISO 8601)',
    },
  },
  webhooks: {
    required: ['id', 'name', 'url'],
    fields: {
      id: 'string', name: 'string', url: 'string', events: 'Array<string>',
      chatIds: 'Array<string>', headers: 'object', secret: 'string|null',
      enabled: 'boolean',
      createdAt: 'string (ISO 8601)', updatedAt: 'string (ISO 8601)',
    },
  },
  settings: {
    required: ['id'],
    fields: { id: '"global"' },
  },
};

export interface AppError extends Error {
  status?: number;
}

export function validate(collection: string, doc: Record<string, unknown>): void {
  const schema = SCHEMAS[collection];
  if (!schema) return;
  for (const field of schema.required) {
    if (doc[field] === undefined || doc[field] === null) {
      const err: AppError = new Error(
        `[Schema] "${collection}" document is missing required field: "${field}"`
      );
      err.status = 400;
      throw err;
    }
  }
}
