'use strict'

import { writeFile, unlink, mkdtemp } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import TypeScriptExecutorBase, { type TypeScriptExecutorConfig } from './TypeScriptExecutorBase'

/**
 * TypeScriptSandboxExecutor - Executes JS/TS code via a temporary script file.
 *
 * Writes the wrapper script to a temp file before execution. Avoids OS
 * argument length limits for large code blocks and provides a slightly more
 * isolated execution environment than spawn mode.
 *
 * - No `function` wrapper needed — just write the body
 * - Supports async/await
 * - Use `return` to return a value
 * - Args available as the `args` object
 *
 * Example:
 * ```js
 * // tool name: add_numbers
 * return args.x + args.y;
 * ```
 */
export class TypeScriptSandboxExecutor extends TypeScriptExecutorBase {
  constructor(config: TypeScriptExecutorConfig = {}) {
    super(config)
  }

  async execute(code: string, args: Record<string, unknown> = {}): Promise<unknown> {
    if (!code || !code.trim()) {
      throw new Error('TypeScript code cannot be empty')
    }

    const wrapper = this._buildWrapper(code, args)
    const tmpDir = await mkdtemp(join(tmpdir(), 'ts-exec-'))
    const scriptPath = join(tmpDir, 'script.js')

    try {
      await writeFile(scriptPath, wrapper, 'utf-8')
      return await this._runScript([scriptPath])
    } finally {
      await unlink(scriptPath).catch(() => {})
    }
  }
}

export default TypeScriptSandboxExecutor
