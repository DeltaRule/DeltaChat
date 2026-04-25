'use strict'

import { randomUUID } from 'crypto'
import { getAdapter, DeltaDatabaseAdapter, Entity } from '../db/DeltaDatabaseAdapter'
import { getSharingService } from './SharingService'

interface AppError extends Error {
  status?: number
}

interface ToolServiceOpts {
  db?: DeltaDatabaseAdapter
}

const VALID_TOOL_TYPES = ['mcp', 'python', 'typescript'] as const
type ToolType = (typeof VALID_TOOL_TYPES)[number]

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

export class ToolService {
  private _db: DeltaDatabaseAdapter

  constructor(opts: ToolServiceOpts = {}) {
    this._db = opts.db ?? getAdapter()
  }

  async listTools(userId: string, userRole: string): Promise<Entity[]> {
    const tools = await this._db.listTools()
    const sharingService = getSharingService()
    const filtered = await sharingService.filterAccessible(userId, userRole, 'tool', tools)
    return filtered.map((t) => ({ ...t, _sharedWithMe: t['ownerId'] !== userId }))
  }

  async getTool(id: string): Promise<Entity | null> {
    return this._db.getTool(id)
  }

  async createTool(data: Record<string, unknown>, ownerId: string): Promise<Entity> {
    const type = data['type'] as string
    if (!VALID_TOOL_TYPES.includes(type as ToolType)) {
      const err: AppError = new Error(
        `Invalid tool type. Must be one of: ${VALID_TOOL_TYPES.join(', ')}`,
      )
      err.status = 400
      throw err
    }
    return this._db.createTool({
      id: randomUUID(),
      name: data['name'] ?? 'Unnamed Tool',
      description: data['description'] ?? null,
      type,
      config: asRecord(data['config']),
      enabled: data['enabled'] !== false,
      ownerId,
    })
  }

  async updateTool(
    id: string,
    data: Record<string, unknown>,
    userId: string,
    userRole: string,
  ): Promise<Entity> {
    const tool = await this._db.getTool(id)
    if (!tool) {
      const err: AppError = new Error('Tool not found')
      err.status = 404
      throw err
    }
    if (tool['ownerId'] && tool['ownerId'] !== userId && userRole !== 'admin') {
      const err: AppError = new Error('Only the owner or an admin can edit this tool')
      err.status = 403
      throw err
    }
    if (typeof data['type'] === 'string' && !VALID_TOOL_TYPES.includes(data['type'] as ToolType)) {
      const err: AppError = new Error(
        `Invalid tool type. Must be one of: ${VALID_TOOL_TYPES.join(', ')}`,
      )
      err.status = 400
      throw err
    }
    const updated = await this._db.updateTool(id, data)
    if (!updated) {
      const err: AppError = new Error('Tool not found')
      err.status = 404
      throw err
    }
    return updated
  }

  async deleteTool(id: string, userId: string, userRole: string): Promise<void> {
    const tool = await this._db.getTool(id)
    if (!tool) {
      const err: AppError = new Error('Tool not found')
      err.status = 404
      throw err
    }
    if (tool['ownerId'] && tool['ownerId'] !== userId && userRole !== 'admin') {
      const err: AppError = new Error('Only the owner or an admin can delete this tool')
      err.status = 403
      throw err
    }
    await this._db.deleteTool(id)
  }

  async checkAccess(userId: string, userRole: string, tool: Entity): Promise<boolean> {
    if (userRole === 'admin') return true
    if (tool['ownerId'] === userId) return true
    const sharingService = getSharingService()
    const allowed = await sharingService.filterAccessible(userId, userRole, 'tool', [tool])
    return allowed.length > 0
  }
}

let _instance: ToolService | null = null
export function getToolService(): ToolService {
  if (!_instance) _instance = new ToolService()
  return _instance
}
