'use strict'

import { execFile } from 'child_process'
import { promisify } from 'util'
import { writeFile, unlink, mkdtemp } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'

const execFileAsync = promisify(execFile)

export interface PythonExecutorConfig {
  pythonPath?: string
  timeout?: number
  maxOutputBytes?: number
  mode?: 'spawn' | 'sandbox'
}

type ExecutionMode = 'spawn' | 'sandbox'

/**
 * PythonExecutor - Executes inline Python code
 *
 * - Code is written without function wrappers (no `def` keyword needed)
 * - Tool name becomes the function name
 * - Code should have a `return` statement with the result
 *
 * Args are passed as a dictionary called `args` automatically
 *
 * Example code:
 * ```
 * # tool name: add_numbers
 * return args['x'] + args['y']
 * ```
 */
export class PythonExecutor {
  private _pythonPath: string
  private _defaultTimeout: number
  private _maxOutputBytes: number
  private _defaultMode: ExecutionMode

  constructor(config: PythonExecutorConfig = {}) {
    this._pythonPath = config.pythonPath || 'python3'
    this._defaultTimeout = config.timeout || 30000
    this._maxOutputBytes = config.maxOutputBytes || 1024 * 1024
    this._defaultMode = config.mode || 'sandbox'
  }

  /**
   * Execute inline Python code with given arguments
   *
   * @param code - Python code to execute (no `def` wrapper needed)
   * @param args - Arguments passed as `args` dictionary to the code
   * @param mode - 'spawn' for subprocess, 'sandbox' for temp file execution
   * @returns The return value from the Python code
   */
  async execute(
    code: string,
    args: Record<string, unknown> = {},
    mode: ExecutionMode = this._defaultMode,
  ): Promise<unknown> {
    if (!code || !code.trim()) {
      throw new Error('Python code cannot be empty')
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
    // Create wrapper that injects args and executes the code
    const wrapper = `
import json, sys
args = json.loads(sys.stdin.read())
${this._indentCode(code)}
${this._extractReturnValue(code)}
`

    try {
      const { stdout, stderr } = await execFileAsync(this._pythonPath, ['-c', wrapper], {
        timeout,
        maxBuffer: this._maxOutputBytes,
        env: {
          PATH: process.env.PATH || '',
          PYTHONPATH: process.env.PYTHONPATH || '',
          HOME: process.env.HOME || process.env.USERPROFILE || '',
        },
        input: JSON.stringify(args),
      } as Parameters<typeof execFileAsync>[2])

      if (stderr) {
        console.warn(`PythonExecutor stderr: ${stderr}`)
      }

      try {
        return JSON.parse((stdout as string).trim()) as unknown
      } catch {
        return { output: (stdout as string).trim() }
      }
    } catch (error: unknown) {
      const err = error as { message?: string; stderr?: string; code?: string }
      const errorMsg =
        err.stderr || (typeof error === 'string' ? error : err.message || 'Python execution failed')
      throw new Error(`Python execution error: ${errorMsg}`, { cause: error })
    }
  }

  private async _executeSandbox(
    code: string,
    args: Record<string, unknown>,
    timeout: number,
  ): Promise<unknown> {
    const wrapper = `
import json, sys
args = json.loads(sys.stdin.read())
${this._indentCode(code)}
${this._extractReturnValue(code)}
`

    const tmpDir = await mkdtemp(join(tmpdir(), 'py-exec-'))
    const scriptPath = join(tmpDir, 'script.py')

    try {
      await writeFile(scriptPath, wrapper, 'utf-8')

      const { stdout, stderr } = await execFileAsync(this._pythonPath, [scriptPath], {
        timeout,
        maxBuffer: this._maxOutputBytes,
        env: {
          PATH: process.env.PATH || '',
          PYTHONPATH: process.env.PYTHONPATH || '',
          HOME: process.env.HOME || process.env.USERPROFILE || '',
        },
        input: JSON.stringify(args),
      } as Parameters<typeof execFileAsync>[2])

      if (stderr) {
        console.warn(`PythonExecutor sandbox stderr: ${stderr}`)
      }

      try {
        return JSON.parse((stdout as string).trim()) as unknown
      } catch {
        return { output: (stdout as string).trim() }
      }
    } catch (error: unknown) {
      const err = error as { message?: string; stderr?: string; code?: string }
      const errorMsg =
        err.stderr || (typeof error === 'string' ? error : err.message || 'Python execution failed')
      throw new Error(`Python sandbox execution error: ${errorMsg}`, { cause: error })
    } finally {
      await unlink(scriptPath).catch(() => {})
    }
  }

  /**
   * Indent code by 1 level (4 spaces) to fit inside the wrapper
   */
  private _indentCode(code: string): string {
    return code
      .split('\n')
      .map((line) => (line.trim() ? '    ' + line : line))
      .join('\n')
  }

  /**
   * Extract return value from code
   * If code contains 'return', wrap it so the result is printed as JSON
   * If it doesn't, assume the last expression is the return value
   */
  private _extractReturnValue(code: string): string {
    if (code.includes('return')) {
      return "print(json.dumps(result) if 'result' in locals() else json.dumps(None))"
    } else {
      // Capture the last expression as the result
      return 'print(json.dumps(result) if "result" in locals() else json.dumps(None))'
    }
  }
}

export default PythonExecutor
