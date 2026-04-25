'use strict'

import { randomUUID } from 'crypto'
import * as Ajv from 'ajv'
import type { Socket } from 'socket.io'
import type PythonExecutorBase from '../modules/FunctionExecutor/python/PythonExecutorBase'
import { type PythonExecutorConfig } from '../modules/FunctionExecutor/python/PythonExecutorBase'
import PythonSpawnExecutor from '../modules/FunctionExecutor/python/PythonSpawnExecutor'
import PythonSandboxExecutor from '../modules/FunctionExecutor/python/PythonSandboxExecutor'
import type TypeScriptExecutorBase from '../modules/FunctionExecutor/typescript/TypeScriptExecutorBase'
import { type TypeScriptExecutorConfig } from '../modules/FunctionExecutor/typescript/TypeScriptExecutorBase'
import TypeScriptSpawnExecutor from '../modules/FunctionExecutor/typescript/TypeScriptSpawnExecutor'
import TypeScriptSandboxExecutor from '../modules/FunctionExecutor/typescript/TypeScriptSandboxExecutor'
import type McpService from './McpService'
import { getAdapter } from '../db/DeltaDatabaseAdapter'

const ajv = new Ajv.default()

/** Maximum time (ms) to wait for a client-side relay response before giving up */
const CLIENT_RELAY_TIMEOUT_MS = 60_000
/** Interval (ms) at which keep-alive pings are sent to the client during a relay call */
const CLIENT_RELAY_PING_INTERVAL_MS = 5_000

export interface PythonExecutorSettings extends PythonExecutorConfig {
  mode?: 'spawn' | 'sandbox'
}

export interface TypeScriptExecutorSettings extends TypeScriptExecutorConfig {
  mode?: 'spawn' | 'sandbox'
}

export interface ExecutorSettings {
  python?: PythonExecutorSettings
  typescript?: TypeScriptExecutorSettings
}

export interface ToolEntity {
  id: string
  name: string
  description?: string | null
  type: 'mcp' | 'python' | 'typescript'
  config: Record<string, unknown>
  enabled?: boolean
}

/**
 * ToolExecutionService - Unified service for executing all tool types
 *
 * Routes tool execution to appropriate executor/handler based on tool type:
 * - MCP (server-scope): delegates to McpService (HTTP or SSE transport)
 * - MCP (client-scope): relays via Socket.IO — emits mcp:relay:call, waits for
 *   mcp:relay:response / mcp:relay:error from the connected browser
 * - Python: uses PythonExecutor with inline code
 * - TypeScript: uses TypeScriptExecutor with inline code
 *
 * Returns bare result values (not wrapped in object)
 */
export class ToolExecutionService {
  private _mcpService: McpService
  private _executorSettings: ExecutorSettings
  private _pythonExecutor?: PythonExecutorBase
  private _typeScriptExecutor?: TypeScriptExecutorBase
  /** Socket.IO socket for the active client connection (set per-request in server.ts) */
  private _socket?: Socket

  constructor(mcpService: McpService, executorSettings: ExecutorSettings = {}, socket?: Socket) {
    this._mcpService = mcpService
    this._executorSettings = executorSettings
    this._socket = socket
  }

  /** Replace the active socket — called when re-using a service instance across requests */
  setSocket(socket: Socket | undefined): void {
    this._socket = socket
  }

  /**
   * Execute a tool with the given arguments
   * @param tool - The tool entity to execute
   * @param args - Arguments to pass to the tool
   * @returns The tool's return value (bare, not wrapped)
   */
  async executeTool(tool: ToolEntity, args: Record<string, unknown> = {}): Promise<unknown> {
    if (tool.enabled === false) {
      throw new Error(`Tool "${tool.name}" is disabled`)
    }

    switch (tool.type) {
      case 'mcp':
        return this._executeMCP(tool, args)
      case 'python':
        return this._executePython(tool, args)
      case 'typescript':
        return this._executeTypeScript(tool, args)
      default:
        throw new Error(`Unknown tool type: ${tool.type}`)
    }
  }

  private async _executeMCP(tool: ToolEntity, args: Record<string, unknown>): Promise<unknown> {
    const config = tool.config as Record<string, unknown>

    const toolName =
      (typeof config['toolName'] === 'string' ? config['toolName'] : null) || tool.name

    if (!toolName) {
      throw new Error('MCP tool requires a toolName in config or tool name')
    }

    // If a connectionId is specified, look up the MCP server from DB
    const connectionId = typeof config['connectionId'] === 'string' ? config['connectionId'] : null

    try {
      if (connectionId) {
        const db = getAdapter()
        const conn = await db.getMcpConnection(connectionId)
        if (!conn) {
          throw new Error(`MCP connection "${connectionId}" not found`)
        }

        const scope = (conn['connectionScope'] as string) ?? 'server'
        const serverUrl = conn['serverUrl'] as string
        const timeout = (conn['timeout'] as number) || 30000
        const transportType = (conn['transportType'] as 'http' | 'sse') ?? 'http'
        const apiKey =
          typeof conn['apiKey'] === 'string' && conn['apiKey'] ? conn['apiKey'] : undefined

        if (scope === 'client') {
          // Client-scope: browser must relay the call to its localhost MCP server
          return await this._executeClientRelay(
            connectionId,
            serverUrl,
            toolName,
            args,
            timeout,
            apiKey,
          )
        }

        // Server-scope: backend calls the MCP server directly
        return await this._mcpService.callToolWithUrl(
          serverUrl,
          timeout,
          toolName,
          args,
          transportType,
          apiKey,
        )
      }

      // Fallback to default MCP server (env var)
      const result = await this._mcpService.callTool(toolName, args)
      return result
    } catch (error) {
      const err = error as Error
      throw new Error(`MCP tool execution failed: ${err.message}`, { cause: error })
    }
  }

  /**
   * Execute a client-scope MCP tool by relaying the call through the active Socket.IO connection.
   *
   * The backend emits `mcp:relay:call` with a unique relayId.  The connected browser
   * receives the event, calls the localhost MCP server directly, and emits back
   * either `mcp:relay:response` (success) or `mcp:relay:error` (failure).
   *
   * While waiting, keep-alive pings (`mcp:relay:ping`) are sent every
   * CLIENT_RELAY_PING_INTERVAL_MS so the frontend knows the call is still running.
   * The overall timeout is CLIENT_RELAY_TIMEOUT_MS.
   */
  private _executeClientRelay(
    connectionId: string,
    serverUrl: string,
    toolName: string,
    args: Record<string, unknown>,
    timeout: number,
    apiKey?: string,
  ): Promise<unknown> {
    if (!this._socket) {
      throw new Error(
        'Client-side MCP tool cannot be executed: no active WebSocket connection. ' +
          'The user must be connected via the chat interface.',
      )
    }

    const socket = this._socket
    const relayId = randomUUID()

    return new Promise((resolve, reject) => {
      const effectiveTimeout = Math.min(timeout, CLIENT_RELAY_TIMEOUT_MS)

      // Send keep-alive pings so the frontend knows we are still waiting
      const pingInterval = setInterval(() => {
        socket.emit(`mcp:relay:ping`, { relayId })
      }, CLIENT_RELAY_PING_INTERVAL_MS)

      const cleanup = () => {
        clearInterval(pingInterval)
        socket.off('mcp:relay:response', onResponse)
        socket.off('mcp:relay:error', onError)
      }

      const timer = setTimeout(() => {
        cleanup()
        reject(
          new Error(
            `Client-side MCP tool "${toolName}" timed out after ${effectiveTimeout}ms — ` +
              'the browser did not respond in time.',
          ),
        )
      }, effectiveTimeout)

      const onResponse = (data: { relayId: string; result: unknown }) => {
        if (data.relayId !== relayId) return
        clearTimeout(timer)
        cleanup()
        resolve(data.result)
      }

      const onError = (data: { relayId: string; error: string }) => {
        if (data.relayId !== relayId) return
        clearTimeout(timer)
        cleanup()
        reject(new Error(data.error ?? 'Client-side MCP relay error'))
      }

      socket.on('mcp:relay:response', onResponse)
      socket.on('mcp:relay:error', onError)

      // Emit the relay call to the browser
      socket.emit('mcp:relay:call', {
        relayId,
        connectionId,
        serverUrl,
        toolName,
        args,
        apiKey: apiKey ?? null,
      })
    })
  }

  private async _executePython(tool: ToolEntity, args: Record<string, unknown>): Promise<unknown> {
    const config = tool.config as Record<string, unknown>
    const code = typeof config['code'] === 'string' ? config['code'] : null

    if (!code) {
      throw new Error('Python tool requires code in config')
    }

    // Validate arguments against schema if provided
    if (config['args_schema']) {
      this._validateArgs(args, config['args_schema'])
    }

    // Create or reuse Python executor (class selected by configured mode, default: sandbox)
    if (!this._pythonExecutor) {
      const { mode: pythonMode, ...pythonConfig } = this._executorSettings.python ?? {}
      this._pythonExecutor =
        pythonMode === 'spawn'
          ? new PythonSpawnExecutor(pythonConfig)
          : new PythonSandboxExecutor(pythonConfig)
    }

    try {
      const result = await this._pythonExecutor.execute(code, args)
      return result
    } catch (error) {
      const err = error as Error
      throw new Error(`Python tool execution failed: ${err.message}`, { cause: error })
    }
  }

  private async _executeTypeScript(
    tool: ToolEntity,
    args: Record<string, unknown>,
  ): Promise<unknown> {
    const config = tool.config as Record<string, unknown>
    const code = typeof config['code'] === 'string' ? config['code'] : null

    if (!code) {
      throw new Error('TypeScript tool requires code in config')
    }

    // Validate arguments against schema if provided
    if (config['args_schema']) {
      this._validateArgs(args, config['args_schema'])
    }

    // Create or reuse TypeScript executor (class selected by configured mode, default: sandbox)
    if (!this._typeScriptExecutor) {
      const { mode: tsMode, ...tsConfig } = this._executorSettings.typescript ?? {}
      this._typeScriptExecutor =
        tsMode === 'spawn'
          ? new TypeScriptSpawnExecutor(tsConfig)
          : new TypeScriptSandboxExecutor(tsConfig)
    }

    try {
      const result = await this._typeScriptExecutor.execute(code, args)
      return result
    } catch (error) {
      const err = error as Error
      throw new Error(`TypeScript tool execution failed: ${err.message}`, { cause: error })
    }
  }

  private _validateArgs(args: Record<string, unknown>, argsSchema: unknown): void {
    if (!argsSchema || typeof argsSchema !== 'object') {
      return // No schema to validate against
    }

    try {
      const validate = ajv.compile(argsSchema as any)
      const valid = validate(args)
      if (!valid) {
        const errors = validate.errors
          ?.map((e: any) => {
            const path = e.instancePath || e.dataPath || 'root'
            return `${path}: ${e.message}`
          })
          .join('; ')
        throw new Error(`Argument validation failed: ${errors}`)
      }
    } catch (error) {
      if (error instanceof Error) {
        throw error
      }
      throw new Error(`Argument validation error: ${error}`, { cause: error })
    }
  }
}

export default ToolExecutionService
