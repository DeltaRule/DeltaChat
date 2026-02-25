'use strict';

/**
 * Schema definitions for DeltaDatabase collections.
 *
 * Each entry describes:
 *   required  – fields that must be present and non-null on insert.
 *   fields    – documentation of the expected field types (informational).
 *
 * Collections
 * ──────────────────────────────────────────────────────────────────────────
 *   chats            – conversation threads
 *   messages         – individual messages within a chat
 *   knowledge_stores – named document repositories for RAG retrieval
 *   documents        – files ingested into a knowledge store
 *   webhooks         – outbound event-notification endpoints
 *   settings         – global application settings (single "global" record)
 */

const SCHEMAS = {
  chats: {
    required: ['id', 'title'],
    fields: {
      id:                'string',
      title:             'string',
      model:             'string|null',
      systemPrompt:      'string|null',
      knowledgeStoreIds: 'Array<string>',
      webhookId:         'string|null',
      metadata:          'object',
      createdAt:         'string (ISO 8601)',
      updatedAt:         'string (ISO 8601)',
    },
  },

  messages: {
    required: ['id', 'chatId', 'role', 'content'],
    fields: {
      id:        'string',
      chatId:    'string',
      role:      '"user"|"assistant"|"system"',
      content:   'string',
      model:     'string|null',
      usage:     'object|null',
      createdAt: 'string (ISO 8601)',
      updatedAt: 'string (ISO 8601)',
    },
  },

  knowledge_stores: {
    required: ['id', 'name'],
    fields: {
      id:             'string',
      name:           'string',
      description:    'string',
      embeddingModel: 'string|null',
      metadata:       'object',
      createdAt:      'string (ISO 8601)',
      updatedAt:      'string (ISO 8601)',
    },
  },

  documents: {
    required: ['id', 'knowledgeStoreId', 'filename'],
    fields: {
      id:               'string',
      knowledgeStoreId: 'string',
      filename:         'string',
      mimeType:         'string',
      size:             'number',
      chunkCount:       'number',
      status:           '"processing"|"indexed"|"error"',
      processorMeta:    'object',
      errorMessage:     'string|null',
      createdAt:        'string (ISO 8601)',
      updatedAt:        'string (ISO 8601)',
    },
  },

  webhooks: {
    required: ['id', 'name', 'url'],
    fields: {
      id:        'string',
      name:      'string',
      url:       'string',
      events:    'Array<string>',
      chatIds:   'Array<string>',
      headers:   'object',
      secret:    'string|null',
      enabled:   'boolean',
      createdAt: 'string (ISO 8601)',
      updatedAt: 'string (ISO 8601)',
    },
  },

  settings: {
    required: ['id'],
    fields: {
      id: '"global"',
    },
  },
};

/**
 * Validate a document against the schema for a collection.
 * Throws a 400 error if any required field is absent or null.
 *
 * @param {string} collection
 * @param {object} doc
 */
function validate(collection, doc) {
  const schema = SCHEMAS[collection];
  if (!schema) return; // no schema defined – skip

  for (const field of schema.required) {
    if (doc[field] === undefined || doc[field] === null) {
      const err = new Error(
        `[Schema] "${collection}" document is missing required field: "${field}"`
      );
      err.status = 400;
      throw err;
    }
  }
}

module.exports = { SCHEMAS, validate };
