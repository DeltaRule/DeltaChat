'use strict';

export interface FunctionDef {
  name: string;
  description?: string;
  parameters?: Record<string, unknown>;
  handler?: (args: Record<string, unknown>) => unknown;
  docker?: {
    image: string;
    command?: string[];
    env?: Record<string, string>;
    timeout?: number;
    memoryMb?: number;
  };
}

abstract class FunctionExecutorBase {
  async execute(_functionName: string, _args: Record<string, unknown>): Promise<unknown> {
    throw new Error(
      `${this.constructor.name} must implement execute(functionName, args)`
    );
  }

  register(_functionDef: FunctionDef): void {
    throw new Error(`${this.constructor.name} must implement register(functionDef)`);
  }
}

export default FunctionExecutorBase;
