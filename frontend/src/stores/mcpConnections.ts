import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '../lib/api'
import { testConnection as mcpTestConnection } from '../lib/mcpClient'
import { useNotificationStore } from './notification'
import type { McpConnection } from '../types'
import { getErrorMessage } from '../types'

export const useMcpConnectionsStore = defineStore('mcpConnections', () => {
  const connections = ref<McpConnection[]>([])

  async function loadConnections(): Promise<void> {
    try {
      const { data } = await api.get<McpConnection[]>('/mcp-connections')
      connections.value = data
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to load MCP connections'))
    }
  }

  async function createConnection(payload: Partial<McpConnection>): Promise<McpConnection> {
    try {
      const res = await api.post<McpConnection>('/mcp-connections', payload)
      connections.value.push(res.data)
      return res.data
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to create MCP connection'))
      throw e
    }
  }

  async function updateConnection(
    id: string,
    payload: Partial<McpConnection>,
  ): Promise<McpConnection> {
    try {
      const res = await api.put<McpConnection>(`/mcp-connections/${id}`, payload)
      const idx = connections.value.findIndex((c) => c.id === id)
      if (idx !== -1) connections.value[idx] = res.data
      return res.data
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to update MCP connection'))
      throw e
    }
  }

  async function deleteConnection(id: string): Promise<void> {
    try {
      await api.delete(`/mcp-connections/${id}`)
      connections.value = connections.value.filter((c) => c.id !== id)
    } catch (e: unknown) {
      useNotificationStore().error(getErrorMessage(e, 'Failed to delete MCP connection'))
      throw e
    }
  }

  async function testConnection(
    serverUrl: string,
    connectionId?: string,
  ): Promise<{ ok: boolean; tools: { name: string; description?: string }[]; error?: string }> {
    return mcpTestConnection(serverUrl, connectionId)
  }

  return {
    connections,
    loadConnections,
    createConnection,
    updateConnection,
    deleteConnection,
    testConnection,
  }
})
