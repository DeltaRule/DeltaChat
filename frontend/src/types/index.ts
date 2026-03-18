import type { AxiosError } from 'axios'

// ── Entity types ──

export interface User {
  id: string
  email: string
  name?: string
  role: 'admin' | 'user'
  disabled?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface AiModel {
  id: string
  name: string
  type: 'chat' | 'model' | 'embedding' | 'agent' | 'webhook'
  provider: string
  providerModel: string
  systemPrompt?: string
  temperature?: number
  knowledgeStoreIds?: string[]
  toolIds?: string[]
  webhookId?: string | null
  agentId?: string | null
  enabled?: boolean
  chunkSize?: number
  chunkOverlap?: number
  topK?: number
  description?: string
  ownerId?: string
  _sharedWithMe?: boolean
}

export interface Agent {
  id: string
  name: string
  description?: string
  provider?: string
  providerModel?: string
  systemPrompt?: string
  knowledgeStoreIds?: string[]
  toolIds?: string[]
  ownerId?: string
  _sharedWithMe?: boolean
}

export interface Tool {
  id: string
  name: string
  description?: string
  type: string
  config?: Record<string, unknown>
  enabled?: boolean
  ownerId?: string
  _sharedWithMe?: boolean
}

export interface Chat {
  id: string
  title: string
  modelId?: string | null
  folder?: string | null
  bookmarked?: boolean
  createdAt?: string
  updatedAt?: string
}

export interface ChatMessage {
  id: string | number
  role: 'user' | 'assistant' | 'system'
  content: string
  createdAt?: string
  sources?: MessageSource[]
}

export interface MessageSource {
  storeId?: string
  docId?: string
  chunkId?: string
  filename?: string
  text?: string
}

export interface KnowledgeStore {
  id: string
  name: string
  description?: string
  documentCount?: number
  embeddingModelId?: string | null
  vectorStoreConfig?: Record<string, unknown> | null
  documentProcessorConfig?: Record<string, unknown> | null
  chunkSize?: number | null
  chunkOverlap?: number | null
  chunkUnit?: string | null
  ownerId?: string
  _sharedWithMe?: boolean
}

export interface KnowledgeDocument {
  id: string
  name?: string
  filename?: string
  status?: 'ready' | 'processing' | 'failed' | 'indexed' | 'error'
}

export interface UserGroup {
  id: string
  name: string
  description?: string
  memberIds?: string[]
}

export interface Share {
  id: string
  resourceType: string
  resourceId: string
  targetType: 'user' | 'group'
  targetId: string
}

export interface Webhook {
  id: string
  name?: string
  url?: string
  [key: string]: unknown
}

export interface SettingsData {
  [key: string]: unknown
}

// ── Provider settings types for SettingsPanel ──

export type VectorStoreType = 'local' | 'chroma'
export type DocProcessorType = 'langchain' | 'tika' | 'docling'

export interface VectorStoreAvailability {
  local: boolean
  chroma: boolean
  [key: string]: boolean
}

export interface VectorStoreUrls {
  chroma: string
  [key: string]: string
}

export interface DocProcessorAvailability {
  langchain: boolean
  tika: boolean
  docling: boolean
  [key: string]: boolean
}

export interface DocProcessorUrls {
  tika: string
  docling: string
  [key: string]: string
}

export interface ProviderConfig {
  [key: string]: unknown
}

// ── Error helper types ──

export interface ApiError extends AxiosError {
  response?: AxiosError['response'] & {
    data?: { error?: string }
  }
}

export function getErrorMessage(e: unknown, fallback: string): string {
  const err = e as ApiError
  return err?.response?.data?.error || err?.message || fallback
}
