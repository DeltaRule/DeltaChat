'use strict'

import { writeFile, unlink, mkdtemp } from 'fs/promises'
import { join } from 'path'
import { tmpdir } from 'os'
import PythonExecutorBase, { type PythonExecutorConfig } from './PythonExecutorBase'

/**
 * PythonSandboxExecutor - Executes Python code via a temporary script file.
 *
 * Writes the wrapper script to a temp file before execution. Avoids OS
 * argument length limits for large code blocks and provides a slightly more
 * isolated execution environment than spawn mode.
 *
 * - No `def` wrapper needed — just write the body
 * - Use `return` to return a value
 * - Args available as the `args` dict
 *
 * Example:
 * ```python
 * # tool name: add_numbers
 * return args['x'] + args['y']
 * ```
 */
export class PythonSandboxExecutor extends PythonExecutorBase {
  constructor(config: PythonExecutorConfig = {}) {
    super(config)
  }

  async execute(code: string, args: Record<string, unknown> = {}): Promise<unknown> {
    if (!code || !code.trim()) {
      throw new Error('Python code cannot be empty')
    }

    const wrapper = this._buildWrapper(code)
    const tmpDir = await mkdtemp(join(tmpdir(), 'py-exec-'))
    const scriptPath = join(tmpDir, 'script.py')

    try {
      await writeFile(scriptPath, wrapper, 'utf-8')
      return await this._runScript([scriptPath], JSON.stringify(args))
    } finally {
      await unlink(scriptPath).catch(() => {})
    }
  }
}

export default PythonSandboxExecutor
