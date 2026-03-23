'use strict'

import { Router } from 'express'

const mockAdapter = {
  listTools: jest.fn(),
  getTool: jest.fn(),
  createTool: jest.fn(),
  updateTool: jest.fn(),
  deleteTool: jest.fn(),
}

const mockSharingService = {
  filterAccessible: jest.fn(),
}

jest.mock('../../db/DeltaDatabaseAdapter', () => ({
  getAdapter: () => mockAdapter,
}))

jest.mock('../../services/SharingService', () => ({
  getSharingService: () => mockSharingService,
}))

let router: Router

beforeAll(async () => {
  const mod = await import('../../routes/tools')
  router = mod.default
})

function findHandler(method: string, path: string): (...args: unknown[]) => unknown {
  const layer = (router as any).stack.find(
    (l: any) => l.route?.path === path && l.route?.methods[method],
  )
  if (!layer) throw new Error(`No handler for ${method.toUpperCase()} ${path}`)
  const handlers = layer.route.stack
  return handlers[handlers.length - 1].handle
}

function buildReq(overrides: Record<string, unknown> = {}): any {
  return {
    user: { id: 'u1', role: 'user', email: 'u@test.com', name: 'User' },
    params: {},
    body: {},
    services: {
      toolExecutionService: {
        executeTool: jest.fn().mockResolvedValue({ ok: true }),
      },
    },
    ...overrides,
  }
}

function buildRes(): any {
  return {
    status: jest.fn().mockReturnThis(),
    json: jest.fn().mockReturnThis(),
  }
}

describe('tools execute routes', () => {
  afterEach(() => {
    jest.clearAllMocks()
  })

  test('returns 404 when tool is missing', async () => {
    mockAdapter.getTool.mockResolvedValue(null)

    const req = buildReq({ params: { id: 'missing' }, body: { args: {} } })
    const res = buildRes()

    await findHandler('post', '/:id/execute').call(null, req, res, jest.fn())

    expect(res.status).toHaveBeenCalledWith(404)
    expect(res.json).toHaveBeenCalledWith({ error: 'Tool not found' })
  })

  test('returns 403 when user has no access', async () => {
    mockAdapter.getTool.mockResolvedValue({
      id: 't1',
      name: 'Tool',
      type: 'python',
      ownerId: 'owner-2',
      config: { code: 'return 1', args_schema: { type: 'object' } },
      enabled: true,
    })
    mockSharingService.filterAccessible.mockResolvedValue([])

    const req = buildReq({ params: { id: 't1' }, body: { args: {} } })
    const res = buildRes()

    await findHandler('post', '/:id/execute').call(null, req, res, jest.fn())

    expect(res.status).toHaveBeenCalledWith(403)
    expect(res.json).toHaveBeenCalledWith({ error: 'You do not have access to this tool' })
  })

  test('executes python tool through ToolExecutionService and returns bare result', async () => {
    mockAdapter.getTool.mockResolvedValue({
      id: 't1',
      name: 'adder',
      type: 'python',
      ownerId: 'u1',
      config: {
        code: 'return args["x"] + args["y"]',
        args_schema: { type: 'object' },
      },
      enabled: true,
    })

    const executeTool = jest.fn().mockResolvedValue(5)
    const req = buildReq({
      params: { id: 't1' },
      body: { args: { x: 2, y: 3 } },
      services: { toolExecutionService: { executeTool } },
    })
    const res = buildRes()

    await findHandler('post', '/:id/execute').call(null, req, res, jest.fn())

    expect(executeTool).toHaveBeenCalledWith(
      expect.objectContaining({ id: 't1', type: 'python' }),
      { x: 2, y: 3 },
    )
    expect(res.json).toHaveBeenCalledWith(5)
  })

  test('maps timeout execution errors to 504', async () => {
    mockAdapter.getTool.mockResolvedValue({
      id: 't1',
      name: 'slow-tool',
      type: 'typescript',
      ownerId: 'u1',
      config: {
        code: 'await new Promise(r => setTimeout(r, 10000)); return true;',
        args_schema: { type: 'object' },
      },
      enabled: true,
    })

    const executeTool = jest.fn().mockRejectedValue(new Error('execution timed out after 1000ms'))
    const req = buildReq({
      params: { id: 't1' },
      body: { args: {} },
      services: { toolExecutionService: { executeTool } },
    })
    const res = buildRes()

    await findHandler('post', '/:id/execute').call(null, req, res, jest.fn())

    expect(res.status).toHaveBeenCalledWith(504)
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ error: expect.stringContaining('timed out') }),
    )
  })
})
