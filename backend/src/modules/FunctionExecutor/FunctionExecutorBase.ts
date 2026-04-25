'use strict'

export interface FunctionDef {
  name: string
  description?: string
  parameters?: Record<string, unknown>
  inputSchema?: Record<string, unknown>
  handler?: (args: Record<string, unknown>) => unknown
  docker?: {
    image: string
    command?: string[]
    env?: Record<string, string>
    timeout?: number
    memoryMb?: number
  }
  pythonServer?: {
    baseUrl: string
    toolName?: string
    authToken?: string
    timeout?: number
    endpointPath?: string
  }
}

export interface CommonExecutorConfig {
  timeout?: number
  maxOutputBytes?: number
}

abstract class FunctionExecutorBase {
  abstract execute(code: string, args: Record<string, unknown>): Promise<unknown>
}

export default FunctionExecutorBase
