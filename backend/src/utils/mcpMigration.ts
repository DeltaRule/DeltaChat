'use strict'

import { randomUUID } from 'crypto'
import config from '../config'
import logger from '../logger'
import type { DeltaDatabaseAdapter } from '../db/DeltaDatabaseAdapter'

/**
 * migrateLegacyMcpServerUrl — idempotent startup migration.
 *
 * If the MCP_SERVER_URL environment variable is set and no existing
 * mcp_connections record already has that serverUrl, a new server-scope
 * HTTP-transport connection is created so the URL is visible and manageable
 * in the Settings → MCP Servers tab.
 *
 * The connection is created without an ownerId (admin-visible / global) so
 * every admin can see and manage it.
 */
export async function migrateLegacyMcpServerUrl(db: DeltaDatabaseAdapter): Promise<void> {
  const legacyUrl = config.mcp.serverUrl
  if (!legacyUrl) return // Nothing to migrate

  try {
    const existing = await db.listMcpConnections()
    const alreadyExists = existing.some((c) => (c['serverUrl'] as string) === legacyUrl)

    if (alreadyExists) {
      logger.debug('[McpMigration] Legacy MCP_SERVER_URL already exists in DB — skipping.')
      return
    }

    const now = new Date().toISOString()
    await db.createMcpConnection({
      id: randomUUID(),
      name: 'Default MCP Server (migrated)',
      serverUrl: legacyUrl,
      timeout: 30000,
      connectionScope: 'server',
      transportType: 'http',
      apiKey: null,
      ownerId: null,
      createdAt: now,
      updatedAt: now,
    })

    logger.info(
      `[McpMigration] Created server-scope MCP connection from MCP_SERVER_URL: ${legacyUrl}`,
    )
  } catch (err) {
    // Non-fatal — log and continue
    logger.warn('[McpMigration] Failed to migrate MCP_SERVER_URL (non-fatal):', err)
  }
}
