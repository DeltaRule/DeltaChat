'use strict'

import http from 'http'
import https from 'https'
import axios, { AxiosInstance } from 'axios'
import config from '../config'

interface McpServiceOpts {
  serverUrl?: string
  timeout?: number
}

interface McpCapabilities {
  [key: string]: unknown
}

interface McpError {
  code: number
  message: string
}

interface McpErrorWithMcp extends Error {
  mcpError?: McpError
}

interface McpResponse<T> {
  result?: T
  error?: McpError
}

interface Tool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

interface Resource {
  [key: string]: unknown
}

interface Prompt {
  [key: string]: unknown
}

class McpService {
  private _serverUrl: string
  private _timeout: number
  private _requestId: number
  private _initialized: boolean
  private _capabilities: McpCapabilities
  private _client: AxiosInstance

  // Cache for per-URL clients (used when calling MCP servers from DB connections)
  private _urlClients: Map<string, { client: AxiosInstance; initialized: boolean }> = new Map()

  constructor(opts: McpServiceOpts = {}) {
    this._serverUrl = opts.serverUrl ?? config.mcp.serverUrl
    this._timeout = opts.timeout ?? 30000
    this._requestId = 0
    this._initialized = false
    this._capabilities = {}

    this._client = axios.create({
      baseURL: this._serverUrl,
      timeout: this._timeout,
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      },
      responseType: 'text',
      transformResponse: [(data: string) => data],
    })
  }

  /**
   * Parse a response that may be SSE (text/event-stream) or plain JSON.
   */
  private _parseResponse<T>(rawData: unknown, contentType: string): McpResponse<T> {
    const text = String(rawData)
    if (contentType.includes('text/event-stream')) {
      const dataLine = text.split('\n').find((l: string) => l.startsWith('data: '))
      if (dataLine) return JSON.parse(dataLine.slice(6))
      throw new Error('No data in SSE response')
    }
    return JSON.parse(text)
  }

  get isConfigured(): boolean {
    return Boolean(this._serverUrl)
  }

  // ── JSON-RPC helpers ───────────────────────────────────────────────────────

  private _nextId(): number {
    return ++this._requestId
  }

  private async _call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (!this._serverUrl) {
      throw new Error('MCP server URL is not configured (set MCP_SERVER_URL in .env)')
    }

    const request = {
      jsonrpc: '2.0',
      id: this._nextId(),
      method,
      params,
    }

    const response = await this._client.post('', request)
    const ct = response.headers['content-type'] || ''
    const body = this._parseResponse<T>(response.data, ct)

    if (body.error) {
      const err: McpErrorWithMcp = new Error(
        `MCP error [${body.error.code}]: ${body.error.message}`,
      )
      err.mcpError = body.error
      throw err
    }

    return body.result as T
  }

  // ── MCP protocol methods ───────────────────────────────────────────────────

  async initialize(): Promise<McpCapabilities> {
    if (this._initialized) return this._capabilities

    const result = await this._call<{ capabilities?: McpCapabilities }>('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: { listChanged: false },
        sampling: {},
      },
      clientInfo: {
        name: 'deltachat-backend',
        version: '1.0.0',
      },
    })

    this._capabilities = result.capabilities ?? {}
    this._initialized = true

    this._client
      .post('', {
        jsonrpc: '2.0',
        method: 'notifications/initialized',
        params: {},
      })
      .catch(() => {})

    return this._capabilities
  }

  async listTools(): Promise<Tool[]> {
    await this.initialize()
    const result = await this._call<{ tools?: Tool[] }>('tools/list')
    return result.tools ?? []
  }

  async callTool(toolName: string, args: Record<string, unknown> = {}): Promise<unknown> {
    await this.initialize()
    return this._call('tools/call', {
      name: toolName,
      arguments: args,
    })
  }

  async listResources(): Promise<Resource[]> {
    await this.initialize()
    const result = await this._call<{ resources?: Resource[] }>('resources/list')
    return result.resources ?? []
  }

  async readResource(uri: string): Promise<unknown> {
    await this.initialize()
    return this._call('resources/read', { uri })
  }

  async listPrompts(): Promise<Prompt[]> {
    await this.initialize()
    const result = await this._call<{ prompts?: Prompt[] }>('prompts/list')
    return result.prompts ?? []
  }

  async getPrompt(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    await this.initialize()
    return this._call('prompts/get', { name, arguments: args })
  }

  // ── Per-URL methods (for DB-stored MCP connections) ────────────────────────

  private _getOrCreateClient(serverUrl: string, timeout = 30000, apiKey?: string) {
    // Use a cache key that includes the apiKey so different credentials get separate clients
    const cacheKey = `${serverUrl}::${apiKey ?? ''}`
    let entry = this._urlClients.get(cacheKey)
    if (!entry) {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        Accept: 'application/json, text/event-stream',
      }
      if (apiKey) {
        headers['Authorization'] = `Bearer ${apiKey}`
      }
      entry = {
        client: axios.create({
          baseURL: serverUrl,
          timeout,
          headers,
          responseType: 'text',
          transformResponse: [(data: string) => data],
        }),
        initialized: false,
      }
      this._urlClients.set(cacheKey, entry)
    }
    return entry
  }

  private async _callWithUrl<T>(
    serverUrl: string,
    timeout: number,
    method: string,
    params: Record<string, unknown> = {},
    apiKey?: string,
  ): Promise<T> {
    const entry = this._getOrCreateClient(serverUrl, timeout, apiKey)

    // Auto-initialize if needed
    if (!entry.initialized) {
      const initReq = {
        jsonrpc: '2.0',
        id: this._nextId(),
        method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities: { roots: { listChanged: false }, sampling: {} },
          clientInfo: { name: 'deltachat-backend', version: '1.0.0' },
        },
      }
      await entry.client.post('', initReq)
      entry.initialized = true
      entry.client
        .post('', { jsonrpc: '2.0', method: 'notifications/initialized', params: {} })
        .catch(() => {})
    }

    const request = {
      jsonrpc: '2.0',
      id: this._nextId(),
      method,
      params,
    }

    const response = await entry.client.post('', request)
    const ct = response.headers['content-type'] || ''
    const body = this._parseResponse<T>(response.data, ct)

    if (body.error) {
      const err: McpErrorWithMcp = new Error(
        `MCP error [${body.error.code}]: ${body.error.message}`,
      )
      err.mcpError = body.error
      throw err
    }

    return body.result as T
  }

  /**
   * MCP SSE transport — two-channel protocol (MCP spec 2024-11-05):
   *
   *   1. GET  {serverUrl}           Accept: text/event-stream  → long-lived SSE stream
   *   2. Wait for `event: endpoint` → gives us a session-scoped POST URL
   *   3. POST {postUrl}             JSON-RPC request
   *   4. Wait for `event: message`  on the SSE stream → JSON-RPC response
   *   5. Close stream and return result
   *
   * Only used for server-scope connections with transportType=sse.
   */
  private async _callWithUrlSSE<T>(
    serverUrl: string,
    timeout: number,
    method: string,
    params: Record<string, unknown> = {},
    apiKey?: string,
  ): Promise<T> {
    const parsedUrl = new URL(serverUrl)
    const isHttps = parsedUrl.protocol === 'https:'
    const transport = isHttps ? https : http

    const requestHeaders: Record<string, string> = {
      Accept: 'text/event-stream',
      'Cache-Control': 'no-cache',
    }
    if (apiKey) requestHeaders['Authorization'] = `Bearer ${apiKey}`

    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        req.destroy()
        reject(new Error(`MCP SSE transport timed out after ${timeout}ms`))
      }, timeout)

      // Step 1: open SSE connection
      const req = transport.request(
        serverUrl,
        { headers: requestHeaders, method: 'GET' },
        (res) => {
          if (res.statusCode && res.statusCode >= 400) {
            clearTimeout(timer)
            req.destroy()
            return reject(new Error(`MCP SSE GET failed with HTTP ${res.statusCode}`))
          }

          let buffer = ''
          let postUrl: string | null = null
          const rpcId = this._nextId()

          res.on('data', (chunk: Buffer) => {
            buffer += chunk.toString()
            const blocks = buffer.split('\n\n')
            // Keep last incomplete block
            buffer = blocks.pop() ?? ''

            for (const block of blocks) {
              const lines = block.split('\n')
              const eventLine = lines.find((l) => l.startsWith('event:'))
              const dataLine = lines.find((l) => l.startsWith('data:'))
              const event = eventLine ? eventLine.slice(6).trim() : ''
              const data = dataLine ? dataLine.slice(5).trim() : ''

              if (event === 'endpoint' && data && !postUrl) {
                // Step 2: received session endpoint URL
                postUrl = data.startsWith('http') ? data : new URL(data, serverUrl).toString()

                // Step 3: POST JSON-RPC request to session endpoint
                const rpcBody = JSON.stringify({
                  jsonrpc: '2.0',
                  id: rpcId,
                  method,
                  params,
                })
                const postParsed = new URL(postUrl)
                const postTransport = postParsed.protocol === 'https:' ? https : http
                const postHeaders: Record<string, string> = {
                  'Content-Type': 'application/json',
                  'Content-Length': Buffer.byteLength(rpcBody).toString(),
                }
                if (apiKey) postHeaders['Authorization'] = `Bearer ${apiKey}`

                const postReq = postTransport.request(
                  postUrl,
                  { method: 'POST', headers: postHeaders },
                  (postRes) => {
                    postRes.resume() // drain response body
                    if (postRes.statusCode && postRes.statusCode >= 400) {
                      clearTimeout(timer)
                      res.destroy()
                      req.destroy()
                      reject(new Error(`MCP SSE POST failed with HTTP ${postRes.statusCode}`))
                    }
                  },
                )
                postReq.on('error', (e) => {
                  clearTimeout(timer)
                  res.destroy()
                  req.destroy()
                  reject(new Error(`MCP SSE POST error: ${e.message}`))
                })
                postReq.write(rpcBody)
                postReq.end()
              } else if (event === 'message' && data) {
                // Step 4: received JSON-RPC response on SSE stream
                try {
                  const parsed: McpResponse<T> = JSON.parse(data)
                  clearTimeout(timer)
                  res.destroy()
                  req.destroy()
                  if (parsed.error) {
                    const err: McpErrorWithMcp = new Error(
                      `MCP error [${parsed.error.code}]: ${parsed.error.message}`,
                    )
                    err.mcpError = parsed.error
                    reject(err)
                  } else {
                    resolve(parsed.result as T)
                  }
                } catch (e) {
                  clearTimeout(timer)
                  res.destroy()
                  req.destroy()
                  reject(new Error(`Failed to parse MCP SSE message: ${(e as Error).message}`))
                }
              }
            }
          })

          res.on('error', (e) => {
            clearTimeout(timer)
            reject(new Error(`MCP SSE stream error: ${e.message}`))
          })

          res.on('end', () => {
            clearTimeout(timer)
            reject(new Error('MCP SSE stream ended before receiving a response'))
          })
        },
      )

      req.on('error', (e) => {
        clearTimeout(timer)
        reject(new Error(`MCP SSE connection error: ${e.message}`))
      })

      req.end()
    })
  }

  async callToolWithUrl(
    serverUrl: string,
    timeout: number,
    toolName: string,
    args: Record<string, unknown> = {},
    transportType: 'http' | 'sse' = 'http',
    apiKey?: string,
  ): Promise<unknown> {
    if (transportType === 'sse') {
      return this._callWithUrlSSE(
        serverUrl,
        timeout,
        'tools/call',
        {
          name: toolName,
          arguments: args,
        },
        apiKey,
      )
    }
    return this._callWithUrl(
      serverUrl,
      timeout,
      'tools/call',
      {
        name: toolName,
        arguments: args,
      },
      apiKey,
    )
  }

  async listToolsWithUrl(
    serverUrl: string,
    timeout = 30000,
    transportType: 'http' | 'sse' = 'http',
    apiKey?: string,
  ): Promise<Tool[]> {
    let result: { tools?: Tool[] }
    if (transportType === 'sse') {
      result = await this._callWithUrlSSE<{ tools?: Tool[] }>(
        serverUrl,
        timeout,
        'tools/list',
        {},
        apiKey,
      )
    } else {
      result = await this._callWithUrl<{ tools?: Tool[] }>(
        serverUrl,
        timeout,
        'tools/list',
        {},
        apiKey,
      )
    }
    return result.tools ?? []
  }
}

export default McpService
