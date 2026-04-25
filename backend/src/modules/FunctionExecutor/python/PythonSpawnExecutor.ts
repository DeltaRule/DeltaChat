'use strict'

import PythonExecutorBase, { type PythonExecutorConfig } from './PythonExecutorBase'

/**
 * PythonSpawnExecutor - Executes Python code by passing it directly via the -c flag.
 *
 * Suited for short code snippets. Avoids the overhead of a temp file but is
 * subject to OS argument length limits for very large code blocks.
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
export class PythonSpawnExecutor extends PythonExecutorBase {
  constructor(config: PythonExecutorConfig = {}) {
    super(config)
  }

  async execute(code: string, args: Record<string, unknown> = {}): Promise<unknown> {
    if (!code || !code.trim()) {
      throw new Error('Python code cannot be empty')
    }

    const wrapper = this._buildWrapper(code)
    return this._runScript(['-c', wrapper], JSON.stringify(args))
  }
}

export default PythonSpawnExecutor
