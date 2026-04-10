import axios from 'axios'
import api from './api'

interface McpJsonRpcResponse {
  jsonrpc: string
  id: number
  result?: unknown
  error?: { code: number; message: string }
}

interface McpTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

let rpcId = 0

/**
 * Browser-side MCP JSON-RPC client.
 *
 * Tries a direct HTTP call to the MCP server first (works for localhost / same-origin).
 * On CORS failure, falls back to the backend proxy `/api/mcp/proxy`.
 */
async function callRpc(
  serverUrl: string,
  method: string,
  params: Record<string, unknown> = {},
  connectionId?: string,
): Promise<unknown> {
  const request = {
    jsonrpc: '2.0',
    id: ++rpcId,
    method,
    params,
  }

  // Attempt 1: direct call from browser
  try {
    const res = await axios.post<McpJsonRpcResponse>(serverUrl, request, {
      timeout: 15000,
      headers: { 'Content-Type': 'application/json' },
    })
    if (res.data.error) {
      throw new Error(`MCP error [${res.data.error.code}]: ${res.data.error.message}`)
    }
    return res.data.result
  } catch (directErr) {
    // If it's an MCP-level error (not CORS), re-throw directly
    if (directErr instanceof Error && directErr.message.startsWith('MCP error')) {
      throw directErr
    }
    // Fall through to proxy
  }

  // Attempt 2: proxy through backend (CORS-free)
  if (!connectionId) {
    throw new Error('Direct MCP call failed and no connectionId available for proxy fallback')
  }

  const proxyRes = await api.post<McpJsonRpcResponse>('/mcp/proxy', {
    connectionId,
    method,
    params,
  })

  if (proxyRes.data.error) {
    throw new Error(`MCP error [${proxyRes.data.error.code}]: ${proxyRes.data.error.message}`)
  }
  return proxyRes.data.result
}

async function initializeAndNotify(serverUrl: string, connectionId?: string): Promise<unknown> {
  const result = await callRpc(
    serverUrl,
    'initialize',
    {
      protocolVersion: '2024-11-05',
      capabilities: { roots: { listChanged: false }, sampling: {} },
      clientInfo: { name: 'deltachat-frontend', version: '1.0.0' },
    },
    connectionId,
  )

  // Best-effort notification
  try {
    await callRpc(serverUrl, 'notifications/initialized', {}, connectionId)
  } catch {
    // ignore
  }

  return result
}

export async function listTools(serverUrl: string, connectionId?: string): Promise<McpTool[]> {
  await initializeAndNotify(serverUrl, connectionId)
  const result = (await callRpc(serverUrl, 'tools/list', {}, connectionId)) as {
    tools?: McpTool[]
  }
  return result?.tools ?? []
}

export async function callTool(
  serverUrl: string,
  toolName: string,
  args: Record<string, unknown> = {},
  connectionId?: string,
): Promise<unknown> {
  await initializeAndNotify(serverUrl, connectionId)
  return callRpc(serverUrl, 'tools/call', { name: toolName, arguments: args }, connectionId)
}

export async function testConnection(
  serverUrl: string,
  connectionId?: string,
): Promise<{ ok: boolean; tools: McpTool[]; error?: string }> {
  try {
    const tools = await listTools(serverUrl, connectionId)
    return { ok: true, tools }
  } catch (e) {
    return { ok: false, tools: [], error: (e as Error).message }
  }
}
