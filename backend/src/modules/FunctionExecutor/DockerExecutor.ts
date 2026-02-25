'use strict';

import { execFile } from 'child_process';
import { promisify } from 'util';
import FunctionExecutorBase, { FunctionDef } from './FunctionExecutorBase';

const execFileAsync = promisify(execFile);

type DockerFunctionDef = FunctionDef & {
  docker: {
    image: string;
    command?: string[];
    env?: Record<string, string>;
    timeout?: number;
    memoryMb?: number;
  };
};

class DockerExecutor extends FunctionExecutorBase {
  private _registry: Map<string, DockerFunctionDef>;

  constructor() {
    super();
    this._registry = new Map();
  }

  register(functionDef: FunctionDef): void {
    if (!functionDef.name) throw new Error('functionDef.name is required');
    if (!functionDef.docker?.image) {
      throw new Error(
        `DockerExecutor.register: functionDef.docker.image is required for "${functionDef.name}"`
      );
    }
    this._registry.set(functionDef.name, functionDef as DockerFunctionDef);
  }

  async execute(functionName: string, args: Record<string, unknown> = {}): Promise<unknown> {
    const def = this._registry.get(functionName);
    if (!def) {
      throw new Error(`DockerExecutor: function "${functionName}" is not registered`);
    }

    const { image, command = [], env = {}, timeout = 30000, memoryMb } = def.docker;

    const dockerArgs = ['run', '--rm', '--network', 'none'];

    if (memoryMb) dockerArgs.push(`--memory=${memoryMb}m`);

    dockerArgs.push('-e', `FUNCTION_ARGS=${JSON.stringify(args)}`);

    for (const [key, value] of Object.entries(env)) {
      dockerArgs.push('-e', `${key}=${value}`);
    }

    dockerArgs.push(image);
    dockerArgs.push(...command);

    const { stdout } = await execFileAsync('docker', dockerArgs, { timeout });

    try {
      return JSON.parse(stdout.trim()) as unknown;
    } catch {
      return { output: stdout.trim() };
    }
  }

  list(): Omit<DockerFunctionDef, 'docker'>[] {
    return [...this._registry.values()].map(({ docker, ...rest }) => ({
      ...rest,
      docker: { image: docker.image },
    }));
  }
}

export default DockerExecutor;
