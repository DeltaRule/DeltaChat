'use strict'

import EmbeddingProviderBase from './EmbeddingProviderBase'
import type { Entity } from '../../db/DeltaDatabaseAdapter'
import config from '../../config'

export interface EmbeddingProviderConfig {
  provider: string
  model?: string | null
}

/**
 * Create an EmbeddingProvider instance from a saved ai_model entity (type='embedding').
 * Previously this logic was a private function inside KnowledgeService.
 */
export function createEmbeddingFromModel(model: Entity): EmbeddingProviderBase {
  const provider = model['provider'] as string | null
  const providerModel = model['providerModel'] as string | null
  return createEmbeddingProvider({ provider: provider ?? 'ollama', model: providerModel })
}

/**
 * Create an EmbeddingProvider instance from a plain config object.
 */
export function createEmbeddingProvider(cfg: EmbeddingProviderConfig): EmbeddingProviderBase {
  const { provider, model } = cfg

  switch (provider) {
    case 'openai': {
      const OpenAIEmbedding = require('./OpenAIEmbedding').default as new (opts: {
        model?: string
      }) => EmbeddingProviderBase
      return new OpenAIEmbedding({ model: model ?? undefined })
    }
    case 'gemini': {
      const GeminiEmbedding = require('./GeminiEmbedding').default as new (opts: {
        model?: string
      }) => EmbeddingProviderBase
      return new GeminiEmbedding({ model: model ?? undefined })
    }
    case 'cohere': {
      const CohereEmbedding = require('./CohereEmbedding').default as new (opts: {
        model?: string
      }) => EmbeddingProviderBase
      return new CohereEmbedding({ model: model ?? undefined })
    }
    case 'azure': {
      const AzureOpenAIEmbedding = require('./AzureOpenAIEmbedding').default as new (opts: {
        model?: string
      }) => EmbeddingProviderBase
      return new AzureOpenAIEmbedding({ model: model ?? undefined })
    }
    case 'mistral': {
      const MistralEmbedding = require('./MistralEmbedding').default as new (opts: {
        model?: string
      }) => EmbeddingProviderBase
      return new MistralEmbedding({ model: model ?? undefined })
    }
    case 'huggingface': {
      const HuggingFaceEmbedding = require('./HuggingFaceEmbedding').default as new (opts: {
        model?: string
        baseUrl?: string
      }) => EmbeddingProviderBase
      // G-BL-6: Pass baseUrl from config so custom HuggingFace endpoints are honoured
      return new HuggingFaceEmbedding({
        model: model ?? undefined,
        baseUrl: config.huggingface.baseUrl,
      })
    }
    case 'ollama':
    default: {
      const OllamaEmbedding = require('./OllamaEmbedding').default as new (opts: {
        model?: string
      }) => EmbeddingProviderBase
      return new OllamaEmbedding({ model: model ?? undefined })
    }
  }
}
