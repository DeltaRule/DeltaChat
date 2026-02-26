'use strict';

import FunctionExecutorBase, { FunctionDef } from './FunctionExecutorBase';

type FunctionDefWithHandler = FunctionDef & { handler: (args: Record<string, unknown>) => unknown };

class LocalExecutor extends FunctionExecutorBase {
  private _registry: Map<string, FunctionDefWithHandler>;

  constructor() {
    super();
    this._registry = new Map();
  }

  register(functionDef: FunctionDef): void {
    if (!functionDef.name) throw new Error('functionDef.name is required');
    if (typeof functionDef.handler !== 'function') {
      throw new Error(`LocalExecutor.register: functionDef.handler must be a function for "${functionDef.name}"`);
    }
    this._registry.set(functionDef.name, functionDef as FunctionDefWithHandler);
  }

  async execute(functionName: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const def = this._registry.get(functionName);
    if (!def) {
      throw new Error(`LocalExecutor: function "${functionName}" is not registered`);
    }
    return def.handler(args);
  }

  list(): Omit<FunctionDef, 'handler'>[] {
    return [...this._registry.values()].map(({ handler: _h, ...rest }) => rest);
  }
}

export default LocalExecutor;
