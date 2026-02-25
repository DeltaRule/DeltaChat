'use strict';

const { execFile } = require('child_process');
const { promisify } = require('util');
const FunctionExecutorBase = require('./FunctionExecutorBase');

const execFileAsync = promisify(execFile);

/**
 * DockerExecutor
 *
 * Executes registered functions by running a Docker container.
 * Each function definition specifies the Docker image and optional command
 * template.  Arguments are passed as JSON via stdin or environment variables.
 *
 * Function definition schema:
 * {
 *   name: "my-function",
 *   description: "...",
 *   parameters: { ... },   // JSON Schema
 *   docker: {
 *     image: "my-image:latest",
 *     command: ["python", "run.py"],  // optional; overrides container default
 *     env: { KEY: "value" },          // additional env vars
 *     timeout: 30000,                 // ms, default 30 s
 *     memoryMb: 256,                  // --memory limit
 *   }
 * }
 *
 * The container receives the serialised arguments via the FUNCTION_ARGS env
 * variable and must write its JSON result to stdout.
 */
class DockerExecutor extends FunctionExecutorBase {
  constructor() {
    super();
    this._registry = new Map();
  }

  register(functionDef) {
    if (!functionDef.name) throw new Error('functionDef.name is required');
    if (!functionDef.docker?.image) {
      throw new Error(
        `DockerExecutor.register: functionDef.docker.image is required for "${functionDef.name}"`
      );
    }
    this._registry.set(functionDef.name, functionDef);
  }

  async execute(functionName, args = {}) {
    const def = this._registry.get(functionName);
    if (!def) {
      throw new Error(`DockerExecutor: function "${functionName}" is not registered`);
    }

    const { image, command = [], env = {}, timeout = 30000, memoryMb } = def.docker;

    // Build docker run arguments
    const dockerArgs = ['run', '--rm', '--network', 'none'];

    if (memoryMb) dockerArgs.push(`--memory=${memoryMb}m`);

    // Pass serialised arguments via environment variable
    dockerArgs.push('-e', `FUNCTION_ARGS=${JSON.stringify(args)}`);

    // Additional env vars from the function definition
    for (const [key, value] of Object.entries(env)) {
      dockerArgs.push('-e', `${key}=${value}`);
    }

    dockerArgs.push(image);
    dockerArgs.push(...command);

    const { stdout } = await execFileAsync('docker', dockerArgs, { timeout });

    try {
      return JSON.parse(stdout.trim());
    } catch {
      return { output: stdout.trim() };
    }
  }

  list() {
    return [...this._registry.values()].map(({ docker, ...rest }) => ({
      ...rest,
      docker: { image: docker.image },
    }));
  }
}

module.exports = DockerExecutor;
