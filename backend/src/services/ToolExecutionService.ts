'use strict'

import * as Ajv from 'ajv'
import {
  PythonExecutor,
  type PythonExecutorConfig,
} from '../modules/FunctionExecutor/PythonExecutor'
import {
  TypeScriptExecutor,
  type TypeScriptExecutorConfig,
} from '../modules/FunctionExecutor/TypeScriptExecutor'
import type McpService from './McpService'

const ajv = new Ajv.default()

export interface ExecutorSettings {
  python?: PythonExecutorConfig
  typescript?: TypeScriptExecutorConfig
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
 * - MCP: delegates to McpService
 * - Python: uses PythonExecutor with inline code
 * - TypeScript: uses TypeScriptExecutor with inline code
 *
 * Returns bare result values (not wrapped in object)
 */
export class ToolExecutionService {
  private _mcpService: McpService
  private _executorSettings: ExecutorSettings
  private _pythonExecutor?: PythonExecutor
  private _typeScriptExecutor?: TypeScriptExecutor

  constructor(mcpService: McpService, executorSettings: ExecutorSettings = {}) {
    this._mcpService = mcpService
    this._executorSettings = executorSettings
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

    // For MCP tools, either use connectionId to identify which MCP server,
    // or default to the configured MCP service
    const toolName =
      (typeof config['toolName'] === 'string' ? config['toolName'] : null) || tool.name

    if (!toolName) {
      throw new Error('MCP tool requires a toolName in config or tool name')
    }

    try {
      const result = await this._mcpService.callTool(toolName, args)
      return result
    } catch (error) {
      const err = error as Error
      throw new Error(`MCP tool execution failed: ${err.message}`, { cause: error })
    }
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

    // Create or reuse Python executor
    if (!this._pythonExecutor) {
      this._pythonExecutor = new PythonExecutor(this._executorSettings.python)
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

    // Create or reuse TypeScript executor
    if (!this._typeScriptExecutor) {
      this._typeScriptExecutor = new TypeScriptExecutor(this._executorSettings.typescript)
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
