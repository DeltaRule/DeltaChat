'use strict';

const FunctionExecutorBase = require('./FunctionExecutorBase');

/**
 * LocalExecutor
 *
 * Executes registered JavaScript functions in the current Node.js process.
 * Functions are registered with a handler property and called directly.
 * Useful for lightweight, trusted integrations.
 */
class LocalExecutor extends FunctionExecutorBase {
  constructor() {
    super();
    this._registry = new Map(); // name → functionDef
  }

  register(functionDef) {
    if (!functionDef.name) throw new Error('functionDef.name is required');
    if (typeof functionDef.handler !== 'function') {
      throw new Error(`LocalExecutor.register: functionDef.handler must be a function for "${functionDef.name}"`);
    }
    this._registry.set(functionDef.name, functionDef);
  }

  async execute(functionName, args = {}) {
    const def = this._registry.get(functionName);
    if (!def) {
      throw new Error(`LocalExecutor: function "${functionName}" is not registered`);
    }
    return def.handler(args);
  }

  /**
   * List all registered function definitions (without the handler to keep
   * the output serialisable).
   */
  list() {
    return [...this._registry.values()].map(({ handler, ...rest }) => rest);
  }
}

module.exports = LocalExecutor;
