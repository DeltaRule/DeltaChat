'use strict';

import axios, { AxiosInstance } from 'axios';
import config from '../config';

interface McpServiceOpts {
  serverUrl?: string;
  timeout?: number;
}

interface McpCapabilities {
  [key: string]: unknown;
}

interface McpError {
  code: number;
  message: string;
}

interface McpErrorWithMcp extends Error {
  mcpError?: McpError;
}

interface McpResponse<T> {
  result?: T;
  error?: McpError;
}

interface Tool {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface Resource {
  [key: string]: unknown;
}

interface Prompt {
  [key: string]: unknown;
}

class McpService {
  private _serverUrl: string;
  private _timeout: number;
  private _requestId: number;
  private _initialized: boolean;
  private _capabilities: McpCapabilities;
  private _client: AxiosInstance;

  constructor(opts: McpServiceOpts = {}) {
    this._serverUrl = opts.serverUrl ?? config.mcp.serverUrl;
    this._timeout = opts.timeout ?? 30000;
    this._requestId = 0;
    this._initialized = false;
    this._capabilities = {};

    this._client = axios.create({
      baseURL: this._serverUrl,
      timeout: this._timeout,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  get isConfigured(): boolean {
    return Boolean(this._serverUrl);
  }

  // ── JSON-RPC helpers ───────────────────────────────────────────────────────

  private _nextId(): number {
    return ++this._requestId;
  }

  private async _call<T>(method: string, params: Record<string, unknown> = {}): Promise<T> {
    if (!this._serverUrl) {
      throw new Error('MCP server URL is not configured (set MCP_SERVER_URL in .env)');
    }

    const request = {
      jsonrpc: '2.0',
      id: this._nextId(),
      method,
      params,
    };

    const response = await this._client.post<McpResponse<T>>('/', request);
    const body = response.data;

    if (body.error) {
      const err: McpErrorWithMcp = new Error(`MCP error [${body.error.code}]: ${body.error.message}`);
      err.mcpError = body.error;
      throw err;
    }

    return body.result as T;
  }

  // ── MCP protocol methods ───────────────────────────────────────────────────

  async initialize(): Promise<McpCapabilities> {
    if (this._initialized) return this._capabilities;

    const result = await this._call<{ capabilities?: McpCapabilities }>('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {
        roots: { listChanged: false },
        sampling: {},
      },
      clientInfo: {
        name: 'deltachat-backend',
        version: '1.0.0',
      },
    });

    this._capabilities = result.capabilities ?? {};
    this._initialized = true;

    this._client
      .post('/', {
        jsonrpc: '2.0',
        method: 'notifications/initialized',
        params: {},
      })
      .catch(() => {});

    return this._capabilities;
  }

  async listTools(): Promise<Tool[]> {
    await this.initialize();
    const result = await this._call<{ tools?: Tool[] }>('tools/list');
    return result.tools ?? [];
  }

  async callTool(toolName: string, args: Record<string, unknown> = {}): Promise<unknown> {
    await this.initialize();
    return this._call('tools/call', {
      name: toolName,
      arguments: args,
    });
  }

  async listResources(): Promise<Resource[]> {
    await this.initialize();
    const result = await this._call<{ resources?: Resource[] }>('resources/list');
    return result.resources ?? [];
  }

  async readResource(uri: string): Promise<unknown> {
    await this.initialize();
    return this._call('resources/read', { uri });
  }

  async listPrompts(): Promise<Prompt[]> {
    await this.initialize();
    const result = await this._call<{ prompts?: Prompt[] }>('prompts/list');
    return result.prompts ?? [];
  }

  async getPrompt(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    await this.initialize();
    return this._call('prompts/get', { name, arguments: args });
  }
}

export default McpService;
