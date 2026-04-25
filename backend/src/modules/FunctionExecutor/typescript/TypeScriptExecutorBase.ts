'use strict'

import { execFile } from 'child_process'
import { promisify } from 'util'
import FunctionExecutorBase, { type CommonExecutorConfig } from '../FunctionExecutorBase'

const execFileAsync = promisify(execFile)

export interface TypeScriptExecutorConfig extends CommonExecutorConfig {
  nodePath?: string
}

/**
 * TypeScriptExecutorBase - Shared base for all TypeScript/JavaScript executors
 *
 * Provides common wrapper generation (async IIFE), code indentation, environment
 * restriction, and script execution logic.
 *
 * Args are inlined directly into the wrapper script as a JSON literal, so there
 * is no stdin communication. The IIFE captures the `return` value and prints it
 * as JSON to stdout.
 */
export abstract class TypeScriptExecutorBase extends FunctionExecutorBase {
  protected readonly _nodePath: string
  protected readonly _timeout: number
  protected readonly _maxOutputBytes: number

  constructor(config: TypeScriptExecutorConfig = {}) {
    super()
    this._nodePath = config.nodePath || 'node'
    this._timeout = config.timeout || 30000
    this._maxOutputBytes = config.maxOutputBytes || 1024 * 1024
  }

  abstract execute(code: string, args: Record<string, unknown>): Promise<unknown>

  /**
   * Build the Node.js async IIFE wrapper. Args are inlined as a JSON literal.
   * The `return` value of the user code flows through `.then(result => ...)`.
   */
  protected _buildWrapper(code: string, args: Record<string, unknown>): string {
    return [
      '(async () => {',
      `  const args = ${JSON.stringify(args)};`,
      this._indentCode(code),
      '})().then(result => {',
      '  console.log(JSON.stringify(result));',
      '  process.exit(0);',
      '}).catch(err => {',
      '  console.error(err.message || err);',
      '  process.exit(1);',
      '});',
    ].join('\n')
  }

  protected _indentCode(code: string): string {
    return code
      .split('\n')
      .map((line) => (line.trim() ? '  ' + line : line))
      .join('\n')
  }

  protected _safeEnv(): NodeJS.ProcessEnv {
    return {
      PATH: process.env.PATH || '',
      NODE_PATH: process.env.NODE_PATH || '',
      HOME: process.env.HOME || process.env.USERPROFILE || '',
    }
  }

  protected async _runScript(nodeArgs: string[]): Promise<unknown> {
    try {
      const { stdout, stderr } = await execFileAsync(this._nodePath, nodeArgs, {
        timeout: this._timeout,
        maxBuffer: this._maxOutputBytes,
        env: this._safeEnv(),
      } as Parameters<typeof execFileAsync>[2])

      if (stderr) {
        console.warn(`${this.constructor.name} stderr: ${stderr}`)
      }

      const trimmed = (stdout as string).trim()
      try {
        return JSON.parse(trimmed) as unknown
      } catch {
        return { output: trimmed }
      }
    } catch (error: unknown) {
      const err = error as { message?: string; stderr?: string }
      const errorMsg =
        err.stderr ||
        (typeof error === 'string' ? error : err.message || 'TypeScript execution failed')
      throw new Error(`TypeScript execution error: ${errorMsg}`, { cause: error })
    }
  }
}

export default TypeScriptExecutorBase
