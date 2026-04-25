/**
 * useMcpRelay — registers Socket.IO listeners so that the browser can act as
 * a relay for client-scope MCP tool calls.
 *
 * When the backend wants to call a tool on an MCP server running on the user's
 * localhost it emits `mcp:relay:call`.  The frontend receives this event, calls
 * the MCP server directly (same-origin, no CORS issues), and emits back either
 * `mcp:relay:response` or `mcp:relay:error`.
 *
 * Keep-alive pings (`mcp:relay:ping { relayId }`) are acknowledged with
 * `mcp:relay:alive { relayId }` so the backend knows the browser is still active
 * while a slow tool call is in progress.
 */

import type { Socket } from 'socket.io-client'
import { callToolDirect } from '../lib/mcpClient'

interface RelayCallPayload {
  relayId: string
  connectionId: string
  serverUrl: string
  toolName: string
  args: Record<string, unknown>
  apiKey: string | null
}

interface RelayPingPayload {
  relayId: string
}

/**
 * Attach the MCP relay listeners to the given Socket.IO socket.
 * Call once after the socket is connected (e.g. in the chat store).
 * Returns a cleanup function that removes the listeners.
 */
export function setupMcpRelay(socket: Socket): () => void {
  async function onRelayCall(payload: RelayCallPayload) {
    const { relayId, serverUrl, toolName, args, apiKey } = payload

    try {
      const result = await callToolDirect(serverUrl, toolName, args ?? {}, apiKey ?? undefined)
      socket.emit('mcp:relay:response', { relayId, result })
    } catch (e) {
      socket.emit('mcp:relay:error', {
        relayId,
        error: e instanceof Error ? e.message : String(e),
      })
    }
  }

  function onRelayPing(payload: RelayPingPayload) {
    socket.emit('mcp:relay:alive', { relayId: payload.relayId })
  }

  socket.on('mcp:relay:call', onRelayCall)
  socket.on('mcp:relay:ping', onRelayPing)

  return () => {
    socket.off('mcp:relay:call', onRelayCall)
    socket.off('mcp:relay:ping', onRelayPing)
  }
}
