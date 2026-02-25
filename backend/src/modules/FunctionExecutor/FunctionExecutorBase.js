'use strict';

/**
 * FunctionExecutorBase – abstract base class for function execution backends.
 *
 * A "function" in this context is a callable unit registered by name,
 * similar to OpenAI Function Calling or tool use.
 */
class FunctionExecutorBase {
  /**
   * Execute a registered function by name with the given arguments.
   * @param {string} functionName - Name of the function to execute.
   * @param {object} args         - Arguments to pass to the function.
   * @returns {Promise<any>}      - Return value of the function.
   */
  async execute(functionName, args) {
    throw new Error(
      `${this.constructor.name} must implement execute(functionName, args)`
    );
  }

  /**
   * Register a function definition so it can be called via execute().
   * @param {object} functionDef
   * @param {string}   functionDef.name        - Unique function identifier.
   * @param {string}   [functionDef.description]
   * @param {object}   [functionDef.parameters] - JSON Schema for arguments.
   * @param {Function} [functionDef.handler]    - Callable (for local executors).
   * @param {object}   [functionDef.docker]     - Docker spec (for Docker executor).
   * @returns {void}
   */
  register(functionDef) {
    throw new Error(`${this.constructor.name} must implement register(functionDef)`);
  }
}

module.exports = FunctionExecutorBase;
