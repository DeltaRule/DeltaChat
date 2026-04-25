'use strict'

import { execFileSync, spawn } from 'child_process'
import FunctionExecutorBase, { type CommonExecutorConfig } from '../FunctionExecutorBase'

/**
 * Detect the correct Python executable once at module load time.
 * Resolution order:
 *   1. PYTHON_PATH environment variable (explicit override)
 *   2. `python3` (standard on Linux/macOS)
 *   3. `python`  (standard on Windows; also works where `python3` is absent)
 * Falls back to `python3` if neither resolves (error surfaced at execution time).
 */
function detectPythonExecutable(): string {
  if (process.env['PYTHON_PATH']) return process.env['PYTHON_PATH']
  for (const candidate of ['python3', 'python']) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'pipe', timeout: 3000 })
      return candidate
    } catch {
      // try next candidate
    }
  }
  return 'python3'
}

const DETECTED_PYTHON = detectPythonExecutable()

export interface PythonExecutorConfig extends CommonExecutorConfig {
  pythonPath?: string
}

/**
 * PythonExecutorBase - Shared base for all Python executors
 *
 * Provides common Python wrapper generation, code indentation, environment
 * restriction, and script execution logic.
 *
 * The Python wrapper wraps user code in a function so that `return` statements
 * work correctly at the top level of the user's code.
 */
export abstract class PythonExecutorBase extends FunctionExecutorBase {
  protected readonly _pythonPath: string
  protected readonly _timeout: number
  protected readonly _maxOutputBytes: number

  constructor(config: PythonExecutorConfig = {}) {
    super()
    this._pythonPath = config.pythonPath || DETECTED_PYTHON
    this._timeout = config.timeout || 30000
    this._maxOutputBytes = config.maxOutputBytes || 1024 * 1024
  }

  abstract execute(code: string, args: Record<string, unknown>): Promise<unknown>

  /**
   * Build the Python wrapper script that injects `args` and captures return values.
   * User code is wrapped in `def _execute(args):` so `return` works correctly.
   */
  protected _buildWrapper(code: string): string {
    return [
      'import json, sys',
      '',
      'def _execute(args):',
      this._indentCode(code),
      '',
      '_result = _execute(json.loads(sys.stdin.read()))',
      'print(json.dumps(_result))',
    ].join('\n')
  }

  protected _indentCode(code: string): string {
    return code
      .split('\n')
      .map((line) => (line.trim() ? '    ' + line : line))
      .join('\n')
  }

  protected _safeEnv(): NodeJS.ProcessEnv {
    return {
      PATH: process.env.PATH || '',
      PYTHONPATH: process.env.PYTHONPATH || '',
      HOME: process.env.HOME || process.env.USERPROFILE || '',
    }
  }

  protected _runScript(pythonArgs: string[], argsJson: string): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const child = spawn(this._pythonPath, pythonArgs, {
        env: this._safeEnv(),
        stdio: ['pipe', 'pipe', 'pipe'],
      })

      let stdout = ''
      let stderr = ''
      let settled = false

      const timer = setTimeout(() => {
        if (settled) return
        settled = true
        child.kill()
        reject(new Error(`Python execution timed out after ${this._timeout}ms`))
      }, this._timeout)

      child.stdout.on('data', (chunk: Buffer) => {
        stdout += chunk.toString()
        if (Buffer.byteLength(stdout) > this._maxOutputBytes) {
          if (settled) return
          settled = true
          clearTimeout(timer)
          child.kill()
          reject(new Error('Python output exceeded max buffer size'))
        }
      })

      child.stderr.on('data', (chunk: Buffer) => {
        stderr += chunk.toString()
      })

      child.on('close', () => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        if (stderr) {
          console.warn(`${this.constructor.name} stderr: ${stderr}`)
        }
        const trimmed = stdout.trim()
        try {
          resolve(JSON.parse(trimmed) as unknown)
        } catch {
          resolve({ output: trimmed })
        }
      })

      child.on('error', (err) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(new Error(`Python execution error: ${err.message}`, { cause: err }))
      })

      child.stdin.write(argsJson)
      child.stdin.end()
    })
  }
}

export default PythonExecutorBase
