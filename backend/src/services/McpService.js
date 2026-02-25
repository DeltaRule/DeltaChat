'use strict';

const axios = require('axios');
const config = require('../config');

/**
 * McpService
 *
 * Implements a Model Context Protocol (MCP) client.
 * Connects to an MCP server and exposes methods to list available tools
 * and call them.
 *
 * MCP wire protocol (JSON-RPC 2.0 over HTTP POST):
 *   Request:  { jsonrpc: "2.0", id: <n>, method: "...", params: { ... } }
 *   Response: { jsonrpc: "2.0", id: <n>, result: { ... } }
 *             { jsonrpc: "2.0", id: <n>, error: { code, message } }
 *
 * Relevant MCP methods:
 *   initialize              – negotiate capabilities
 *   tools/list              – list available tools
 *   tools/call              – invoke a tool
 */
class McpService {
  /**
   * @param {object} [opts]
   * @param {string} [opts.serverUrl] - MCP server base URL.
   * @param {number} [opts.timeout]   - Request timeout in ms.
   */
  constructor(opts = {}) {
    this._serverUrl = opts.serverUrl || config.mcp.serverUrl;
    this._timeout = opts.timeout || 30000;
    this._requestId = 0;
    this._initialized = false;
    this._capabilities = {};

    this._client = axios.create({
      baseURL: this._serverUrl,
      timeout: this._timeout,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  get isConfigured() {
    return Boolean(this._serverUrl);
  }

  // ── JSON-RPC helpers ───────────────────────────────────────────────────────

  _nextId() {
    return ++this._requestId;
  }

  async _call(method, params = {}) {
    if (!this._serverUrl) {
      throw new Error('MCP server URL is not configured (set MCP_SERVER_URL in .env)');
    }

    const request = {
      jsonrpc: '2.0',
      id: this._nextId(),
      method,
      params,
    };

    const response = await this._client.post('/', request);
    const body = response.data;

    if (body.error) {
      const err = new Error(`MCP error [${body.error.code}]: ${body.error.message}`);
      err.mcpError = body.error;
      throw err;
    }

    return body.result;
  }

  // ── MCP protocol methods ───────────────────────────────────────────────────

  /**
   * Negotiate capabilities with the MCP server.
   * Called automatically on the first tool operation.
   */
  async initialize() {
    if (this._initialized) return this._capabilities;

    const result = await this._call('initialize', {
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

    this._capabilities = result.capabilities || {};
    this._initialized = true;

    // Send initialized notification (fire-and-forget)
    this._client
      .post('/', {
        jsonrpc: '2.0',
        method: 'notifications/initialized',
        params: {},
      })
      .catch(() => {});

    return this._capabilities;
  }

  /**
   * List all tools exposed by the MCP server.
   * @returns {Promise<Array<{ name, description, inputSchema }>>}
   */
  async listTools() {
    await this.initialize();
    const result = await this._call('tools/list');
    return result.tools || [];
  }

  /**
   * Call an MCP tool by name.
   * @param {string} toolName  - Tool identifier.
   * @param {object} args      - Tool arguments matching its inputSchema.
   * @returns {Promise<{ content: Array<{ type, text }>, isError: boolean }>}
   */
  async callTool(toolName, args = {}) {
    await this.initialize();
    const result = await this._call('tools/call', {
      name: toolName,
      arguments: args,
    });
    return result;
  }

  /**
   * List resources exposed by the MCP server (if supported).
   * @returns {Promise<Array>}
   */
  async listResources() {
    await this.initialize();
    const result = await this._call('resources/list');
    return result.resources || [];
  }

  /**
   * Read a specific resource.
   * @param {string} uri - Resource URI.
   * @returns {Promise<object>}
   */
  async readResource(uri) {
    await this.initialize();
    return this._call('resources/read', { uri });
  }

  /**
   * List available prompts.
   * @returns {Promise<Array>}
   */
  async listPrompts() {
    await this.initialize();
    const result = await this._call('prompts/list');
    return result.prompts || [];
  }

  /**
   * Get a specific prompt with optional arguments.
   * @param {string} name  - Prompt name.
   * @param {object} args  - Prompt arguments.
   * @returns {Promise<object>}
   */
  async getPrompt(name, args = {}) {
    await this.initialize();
    return this._call('prompts/get', { name, arguments: args });
  }
}

module.exports = McpService;
