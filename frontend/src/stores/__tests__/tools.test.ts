import { describe, test, expect, beforeEach } from 'vitest'
import { mockApi, mockNotify, setupStoreTest } from './setup'
import { useToolsStore } from '../tools'

describe('tools store', () => {
  beforeEach(() => setupStoreTest())

  test('loadTools populates tools on success', async () => {
    mockApi.get.mockResolvedValue({ data: [{ id: 't1', name: 'Search' }] })
    const store = useToolsStore()
    await store.loadTools()
    expect(store.tools).toEqual([{ id: 't1', name: 'Search' }])
  })

  test('loadTools shows notification on failure', async () => {
    mockApi.get.mockRejectedValue({ response: { data: { error: 'Down' } } })
    const store = useToolsStore()
    await store.loadTools()
    expect(mockNotify.error).toHaveBeenCalledWith('Down')
  })

  test('createTool adds to store on success', async () => {
    mockApi.post.mockResolvedValue({ data: { id: 't2', name: 'Calc' } })
    const store = useToolsStore()
    const result = await store.createTool({ name: 'Calc' })
    expect(result).toEqual({ id: 't2', name: 'Calc' })
    expect(store.tools).toContainEqual({ id: 't2', name: 'Calc' })
  })

  test('createTool shows notification on failure', async () => {
    mockApi.post.mockRejectedValue({ response: { data: { error: 'Invalid' } } })
    const store = useToolsStore()
    await expect(store.createTool({})).rejects.toBeTruthy()
    expect(mockNotify.error).toHaveBeenCalledWith('Invalid')
  })

  test('updateTool updates in store', async () => {
    mockApi.get.mockResolvedValue({ data: [{ id: 't1', name: 'Old' }] })
    const store = useToolsStore()
    await store.loadTools()
    mockApi.put.mockResolvedValue({ data: { id: 't1', name: 'New' } })
    await store.updateTool('t1', { name: 'New' })
    expect(store.tools.find((t) => t.id === 't1')!.name).toBe('New')
  })

  test('updateTool shows notification on failure', async () => {
    mockApi.put.mockRejectedValue({ response: { data: { error: 'Nope' } } })
    const store = useToolsStore()
    await expect(store.updateTool('t1', {})).rejects.toBeTruthy()
    expect(mockNotify.error).toHaveBeenCalledWith('Nope')
  })

  test('deleteTool removes from store', async () => {
    mockApi.get.mockResolvedValue({ data: [{ id: 't1' }] })
    const store = useToolsStore()
    await store.loadTools()
    mockApi.delete.mockResolvedValue({})
    await store.deleteTool('t1')
    expect(store.tools).toHaveLength(0)
  })

  test('deleteTool shows notification on failure', async () => {
    mockApi.delete.mockRejectedValue({ response: { data: { error: 'Locked' } } })
    const store = useToolsStore()
    await expect(store.deleteTool('t1')).rejects.toBeTruthy()
    expect(mockNotify.error).toHaveBeenCalledWith('Locked')
  })
})
