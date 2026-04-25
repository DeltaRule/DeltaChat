'use strict'

import { randomUUID } from 'crypto'
import { getAdapter, DeltaDatabaseAdapter, Entity } from '../db/DeltaDatabaseAdapter'
import { getSharingService } from './SharingService'

interface AppError extends Error {
  status?: number
}

interface ModelServiceOpts {
  db?: DeltaDatabaseAdapter
}

export class ModelService {
  private _db: DeltaDatabaseAdapter

  constructor(opts: ModelServiceOpts = {}) {
    this._db = opts.db ?? getAdapter()
  }

  async listModels(userId: string, userRole: string): Promise<Entity[]> {
    const models = await this._db.listAiModels()
    const sharingService = getSharingService()
    const filtered = await sharingService.filterAccessible(userId, userRole, 'ai_model', models)
    return filtered.map((m) => ({ ...m, _sharedWithMe: m['ownerId'] !== userId }))
  }

  async getModel(id: string): Promise<Entity | null> {
    return this._db.getAiModel(id)
  }

  async createModel(data: Record<string, unknown>, ownerId: string): Promise<Entity> {
    return this._db.createAiModel({
      id: randomUUID(),
      name: data['name'] ?? 'Unnamed Model',
      description: data['description'] ?? null,
      type: data['type'] ?? 'model',
      provider: data['provider'] ?? null,
      providerModel: data['providerModel'] ?? null,
      deploymentName: data['deploymentName'] ?? null,
      systemPrompt: data['systemPrompt'] ?? null,
      temperature: data['temperature'] ?? null,
      maxTokens: data['maxTokens'] ?? null,
      knowledgeStoreIds: data['knowledgeStoreIds'] ?? [],
      toolIds: data['toolIds'] ?? [],
      webhookId: data['webhookId'] ?? null,
      agentId: data['agentId'] ?? null,
      enabled: data['enabled'] !== false,
      ownerId,
    })
  }

  async updateModel(
    id: string,
    data: Record<string, unknown>,
    userId: string,
    userRole: string,
  ): Promise<Entity> {
    const model = await this._db.getAiModel(id)
    if (!model) {
      const err: AppError = new Error('Model not found')
      err.status = 404
      throw err
    }
    if (model['ownerId'] && model['ownerId'] !== userId && userRole !== 'admin') {
      const err: AppError = new Error('Only the owner or an admin can edit this model')
      err.status = 403
      throw err
    }
    const updated = await this._db.updateAiModel(id, data)
    if (!updated) {
      const err: AppError = new Error('Model not found')
      err.status = 404
      throw err
    }
    return updated
  }

  async deleteModel(id: string, userId: string, userRole: string): Promise<void> {
    const model = await this._db.getAiModel(id)
    if (!model) {
      const err: AppError = new Error('Model not found')
      err.status = 404
      throw err
    }
    if (model['ownerId'] && model['ownerId'] !== userId && userRole !== 'admin') {
      const err: AppError = new Error('Only the owner or an admin can delete this model')
      err.status = 403
      throw err
    }
    await this._db.deleteAiModel(id)
  }
}

let _instance: ModelService | null = null
export function getModelService(): ModelService {
  if (!_instance) _instance = new ModelService()
  return _instance
}
