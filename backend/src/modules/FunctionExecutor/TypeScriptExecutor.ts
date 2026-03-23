'use strict'

import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, mkdtemp } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const execFileAsync = promisify(execFile)

export interface TypeScriptExecutorConfig {
  nodePath?: string
  timeout?: number
  maxOutputBytes?: number
  mode?: 'spawn' | 'sandbox'
}

type ExecutionMode = 'spawn' | 'sandbox'

/**
 * TypeScriptExecutor - Executes inline TypeScript/JavaScript code
 *
 * - Code is written without function wrappers (no `function` keyword needed)
 * - Tool name becomes the function name
 * - Code should have a `return` statement with the result
 * - Supports async/await
 *
 * Args are passed as an object called `args` automatically
 *
 * Example code (synchronous):
 * ```
 * // tool name: add_numbers
 * return args.x + args.y;
 * ```
 *
 * Example code (async):
 * ```
 * // tool name: fetch_data
 * const response = await fetch(args.url);
 * return response.json();
 * ```
 */
export class TypeScriptExecutor {
  private _nodePath: string
  private _defaultTimeout: number
  private _maxOutputBytes: number
  private _defaultMode: ExecutionMode

  constructor(config: TypeScriptExecutorConfig = {}) {
    this._nodePath = config.nodePath || 'node'
    this._defaultTimeout = config.timeout || 30000
    this._maxOutputBytes = config.maxOutputBytes || 1024 * 1024
    this._defaultMode = config.mode || 'sandbox'
  }

  /**
   * Execute inline TypeScript/JavaScript code with given arguments
   *
   * @param code - TypeScript/JavaScript code to execute (no `function` wrapper needed)
   * @param args - Arguments passed as `args` object to the code
   * @param mode - 'spawn' for subprocess, 'sandbox' for inline execution
   * @returns The return value from the code
   */
  async execute(
    code: string,
    args: Record<string, unknown> = {},
    mode: ExecutionMode = this._defaultMode,
  ): Promise<unknown> {
    if (!code || !code.trim()) {
      throw new Error('TypeScript code cannot be empty')
    }

    const timeout = this._defaultTimeout

    if (mode === 'spawn') {
      return this._executeSpawn(code, args, timeout)
    } else {
      return this._executeSandbox(code, args, timeout)
    }
  }

  private async _executeSpawn(
    code: string,
    args: Record<string, unknown>,
    timeout: number,
  ): Promise<unknown> {
    // Wrap code in async IIFE to support async/await
    const wrapper = `
(async () => {
  const args = ${JSON.stringify(args)};
  ${this._indentCode(code)}
})().then(result => {
  console.log(JSON.stringify(result));
  process.exit(0);
}).catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
`

    try {
      const { stdout, stderr } = await execFileAsync(this._nodePath, ['-e', wrapper], {
        timeout,
        maxBuffer: this._maxOutputBytes,
        env: process.env,
      } as Parameters<typeof execFileAsync>[2])

      if (stderr) {
        console.warn(`TypeScriptExecutor spawn stderr: ${stderr}`)
      }

      try {
        return JSON.parse((stdout as string).trim()) as unknown
      } catch {
        return { output: (stdout as string).trim() }
      }
    } catch (error: unknown) {
      const err = error as { message?: string; stderr?: string; code?: string }
      const errorMsg =
        err.stderr ||
        (typeof error === 'string' ? error : err.message || 'TypeScript execution failed')
      throw new Error(`TypeScript execution error: ${errorMsg}`, { cause: error })
    }
  }

  private async _executeSandbox(
    code: string,
    args: Record<string, unknown>,
    timeout: number,
  ): Promise<unknown> {
    // For sandbox mode, use subprocess for containment (safer than eval/vm)
    // Write code to temp file and execute with Node
    const wrapper = `
(async () => {
  const args = ${JSON.stringify(args)};
  ${this._indentCode(code)}
})().then(result => {
  console.log(JSON.stringify(result));
  process.exit(0);
}).catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
`

    const tmpDir = await mkdtemp(join(tmpdir(), 'ts-exec-'))
    const scriptPath = join(tmpDir, 'script.js')

    try {
      await writeFile(scriptPath, wrapper, 'utf-8')

      const { stdout, stderr } = await execFileAsync(this._nodePath, [scriptPath], {
        timeout,
        maxBuffer: this._maxOutputBytes,
        env: process.env,
      } as Parameters<typeof execFileAsync>[2])

      if (stderr) {
        console.warn(`TypeScriptExecutor sandbox stderr: ${stderr}`)
      }

      try {
        return JSON.parse((stdout as string).trim()) as unknown
      } catch {
        return { output: (stdout as string).trim() }
      }
    } catch (error: unknown) {
      const err = error as { message?: string; stderr?: string; code?: string }
      const errorMsg =
        err.stderr ||
        (typeof error === 'string' ? error : err.message || 'TypeScript execution failed')
      throw new Error(`TypeScript sandbox execution error: ${errorMsg}`, { cause: error })
    } finally {
      await unlink(scriptPath).catch(() => {})
    }
  }

  /**
   * Indent code by 1 level (2 spaces) to fit inside the wrapper
   */
  private _indentCode(code: string): string {
    return code
      .split('\n')
      .map((line) => (line.trim() ? '  ' + line : line))
      .join('\n')
  }
}

export default TypeScriptExecutor
