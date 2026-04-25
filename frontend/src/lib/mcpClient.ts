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
 * Parse an SSE text body and extract the first JSON-RPC message from the
 * `event: message` stream.  Falls back to parsing the entire body as JSON
 * (for servers that return plain JSON instead of SSE).
 */
function parseResponse(text: string, contentType: string): McpJsonRpcResponse {
  if (contentType.includes('text/event-stream')) {
    for (const block of text.split('\n\n')) {
      const dataLine = block.split('\n').find((l) => l.startsWith('data: '))
      if (dataLine) return JSON.parse(dataLine.slice(6))
    }
    throw new Error('No data in SSE response')
  }
  return JSON.parse(text)
}

/**
 * Browser-side MCP JSON-RPC client.
 *
 * Tries a direct HTTP call to the MCP server first (works for localhost / same-origin).
 * On CORS failure, falls back to the backend proxy `/api/mcp/proxy`.
 *
 * @param apiKey Optional Bearer token to send to the MCP server.
 */
async function callRpc(
  serverUrl: string,
  method: string,
  params: Record<string, unknown> = {},
  connectionId?: string,
  apiKey?: string,
): Promise<unknown> {
  const request = {
    jsonrpc: '2.0',
    id: ++rpcId,
    method,
    params,
  }

  const directHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json, text/event-stream',
  }
  if (apiKey) directHeaders['Authorization'] = `Bearer ${apiKey}`

  // Attempt 1: direct call from browser using fetch (supports SSE responses)
  try {
    const res = await fetch(serverUrl, {
      method: 'POST',
      headers: directHeaders,
      body: JSON.stringify(request),
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const text = await res.text()
    const data = parseResponse(text, res.headers.get('content-type') || '')
    if (data.error) {
      throw new Error(`MCP error [${data.error.code}]: ${data.error.message}`)
    }
    return data.result
  } catch (directErr) {
    // If it's an MCP-level error (not CORS), re-throw directly
    if (directErr instanceof Error && directErr.message.startsWith('MCP error')) {
      throw directErr
    }
    // Fall through to proxy
  }

  // Attempt 2: proxy through backend (CORS-free, server-scope connections only)
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

async function initializeAndNotify(
  serverUrl: string,
  connectionId?: string,
  apiKey?: string,
): Promise<unknown> {
  const result = await callRpc(
    serverUrl,
    'initialize',
    {
      protocolVersion: '2024-11-05',
      capabilities: { roots: { listChanged: false }, sampling: {} },
      clientInfo: { name: 'deltachat-frontend', version: '1.0.0' },
    },
    connectionId,
    apiKey,
  )

  // Best-effort notification
  try {
    await callRpc(serverUrl, 'notifications/initialized', {}, connectionId, apiKey)
  } catch {
    // ignore
  }

  return result
}

export async function listTools(
  serverUrl: string,
  connectionId?: string,
  apiKey?: string,
): Promise<McpTool[]> {
  await initializeAndNotify(serverUrl, connectionId, apiKey)
  const result = (await callRpc(serverUrl, 'tools/list', {}, connectionId, apiKey)) as {
    tools?: McpTool[]
  }
  return result?.tools ?? []
}

export async function callTool(
  serverUrl: string,
  toolName: string,
  args: Record<string, unknown> = {},
  connectionId?: string,
  // Optional Bearer token forwarded to the MCP server
  apiKey?: string,
): Promise<unknown> {
  await initializeAndNotify(serverUrl, connectionId, apiKey)
  return callRpc(serverUrl, 'tools/call', { name: toolName, arguments: args }, connectionId, apiKey)
}

/**
 * Like callTool but always browser-direct (no backend proxy fallback).
 * Used by the WebSocket relay where connectionId is never needed.
 */
export async function callToolDirect(
  serverUrl: string,
  toolName: string,
  args: Record<string, unknown> = {},
  apiKey?: string,
): Promise<unknown> {
  await initializeAndNotify(serverUrl, undefined, apiKey)
  return callRpc(serverUrl, 'tools/call', { name: toolName, arguments: args }, undefined, apiKey)
}

export async function testConnection(
  serverUrl: string,
  connectionId?: string,
  apiKey?: string,
): Promise<{ ok: boolean; tools: McpTool[]; error?: string }> {
  try {
    const tools = await listTools(serverUrl, connectionId, apiKey)
    return { ok: true, tools }
  } catch (e) {
    return { ok: false, tools: [], error: (e as Error).message }
  }
}
