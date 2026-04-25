'use strict'

import { randomUUID } from 'crypto'
import { getAdapter, DeltaDatabaseAdapter, Entity } from '../db/DeltaDatabaseAdapter'
import { getSharingService } from './SharingService'

interface AppError extends Error {
  status?: number
}

interface AgentServiceOpts {
  db?: DeltaDatabaseAdapter
}

export class AgentService {
  private _db: DeltaDatabaseAdapter

  constructor(opts: AgentServiceOpts = {}) {
    this._db = opts.db ?? getAdapter()
  }

  async listAgents(userId: string, userRole: string): Promise<Entity[]> {
    const agents = await this._db.listAgents()
    const sharingService = getSharingService()
    const filtered = await sharingService.filterAccessible(userId, userRole, 'agent', agents)
    return filtered.map((a) => ({ ...a, _sharedWithMe: a['ownerId'] !== userId }))
  }

  async getAgent(id: string): Promise<Entity | null> {
    return this._db.getAgent(id)
  }

  async createAgent(data: Record<string, unknown>, ownerId: string): Promise<Entity> {
    return this._db.createAgent({
      id: randomUUID(),
      name: data['name'] ?? 'Unnamed Agent',
      description: data['description'] ?? null,
      systemPrompt: data['systemPrompt'] ?? '',
      provider: data['provider'] ?? null,
      providerModel: data['providerModel'] ?? null,
      deploymentName: data['deploymentName'] ?? null,
      knowledgeStoreIds: data['knowledgeStoreIds'] ?? [],
      toolIds: data['toolIds'] ?? [],
      temperature: data['temperature'] ?? null,
      maxTokens: data['maxTokens'] ?? null,
      ownerId,
    })
  }

  async updateAgent(
    id: string,
    data: Record<string, unknown>,
    userId: string,
    userRole: string,
  ): Promise<Entity> {
    const agent = await this._db.getAgent(id)
    if (!agent) {
      const err: AppError = new Error('Agent not found')
      err.status = 404
      throw err
    }
    if (agent['ownerId'] && agent['ownerId'] !== userId && userRole !== 'admin') {
      const err: AppError = new Error('Only the owner or an admin can edit this agent')
      err.status = 403
      throw err
    }
    const updated = await this._db.updateAgent(id, data)
    if (!updated) {
      const err: AppError = new Error('Agent not found')
      err.status = 404
      throw err
    }
    return updated
  }

  async deleteAgent(id: string, userId: string, userRole: string): Promise<void> {
    const agent = await this._db.getAgent(id)
    if (!agent) {
      const err: AppError = new Error('Agent not found')
      err.status = 404
      throw err
    }
    if (agent['ownerId'] && agent['ownerId'] !== userId && userRole !== 'admin') {
      const err: AppError = new Error('Only the owner or an admin can delete this agent')
      err.status = 403
      throw err
    }
    await this._db.deleteAgent(id)
  }
}

let _instance: AgentService | null = null
export function getAgentService(): AgentService {
  if (!_instance) _instance = new AgentService()
  return _instance
}
