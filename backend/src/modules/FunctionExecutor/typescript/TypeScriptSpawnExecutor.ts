'use strict'

import TypeScriptExecutorBase, { type TypeScriptExecutorConfig } from './TypeScriptExecutorBase'

/**
 * TypeScriptSpawnExecutor - Executes JS/TS code by passing it directly via the -e flag.
 *
 * Suited for short code snippets. Avoids the overhead of a temp file but is
 * subject to OS argument length limits for very large code blocks.
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
export class TypeScriptSpawnExecutor extends TypeScriptExecutorBase {
  constructor(config: TypeScriptExecutorConfig = {}) {
    super(config)
  }

  async execute(code: string, args: Record<string, unknown> = {}): Promise<unknown> {
    if (!code || !code.trim()) {
      throw new Error('TypeScript code cannot be empty')
    }

    const wrapper = this._buildWrapper(code, args)
    return this._runScript(['-e', wrapper])
  }
}

export default TypeScriptSpawnExecutor
