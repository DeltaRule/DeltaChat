import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js'
import { z } from 'zod'
import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

function createServer() {
  const server = new McpServer({
    name: 'test-mcp-server',
    version: '1.0.0',
  })

  server.tool(
    'get_weather',
    'Get the current weather for a city',
    { city: z.string().describe('City name') },
    async ({ city }) => ({
      content: [{ type: 'text', text: `Weather in ${city}: 22°C, partly cloudy, humidity 58%` }],
    }),
  )

  server.tool(
    'calculate',
    'Evaluate a math expression',
    { expression: z.string().describe('Math expression to evaluate') },
    async ({ expression }) => {
      try {
        const result = String(Function('"use strict"; return (' + expression + ')')())
        return { content: [{ type: 'text', text: `Result: ${result}` }] }
      } catch {
        return { content: [{ type: 'text', text: 'Error evaluating expression' }], isError: true }
      }
    },
  )

  return server
}

// Stateless: new server + transport per request
app.post('/mcp', async (req, res) => {
  const server = createServer()
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined })
  res.on('close', () => { transport.close(); server.close() })
  await server.connect(transport)
  await transport.handleRequest(req, res, req.body)
})

// Handle GET and DELETE for SSE stream management (required by protocol)
app.get('/mcp', async (req, res) => {
  res.writeHead(405).end('Method not allowed — stateless server')
})
app.delete('/mcp', async (req, res) => {
  res.writeHead(405).end('Method not allowed — stateless server')
})

app.listen(3001, () => {
  console.log('🔧 Test MCP server (SDK) running on http://localhost:3001/mcp')
})
