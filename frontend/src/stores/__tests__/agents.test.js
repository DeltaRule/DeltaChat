import { describe, test, expect, beforeEach } from 'vitest'
import { mockApi, mockNotify, setupStoreTest } from './setup'
import { useAgentsStore } from '../agents'

describe('agents store', () => {
  beforeEach(() => setupStoreTest())

  test('loadAgents populates agents on success', async () => {
    mockApi.get.mockResolvedValue({ data: [{ id: 'a1', name: 'Helper' }] })
    const store = useAgentsStore()
    await store.loadAgents()
    expect(store.agents).toEqual([{ id: 'a1', name: 'Helper' }])
  })

  test('loadAgents shows notification on failure', async () => {
    mockApi.get.mockRejectedValue({ response: { data: { error: 'Timeout' } } })
    const store = useAgentsStore()
    await store.loadAgents()
    expect(mockNotify.error).toHaveBeenCalledWith('Timeout')
  })

  test('createAgent adds to store on success', async () => {
    mockApi.post.mockResolvedValue({ data: { id: 'a2', name: 'Coder' } })
    const store = useAgentsStore()
    const result = await store.createAgent({ name: 'Coder' })
    expect(result).toEqual({ id: 'a2', name: 'Coder' })
    expect(store.agents).toContainEqual({ id: 'a2', name: 'Coder' })
  })

  test('createAgent shows notification on failure', async () => {
    mockApi.post.mockRejectedValue({ response: { data: { error: 'Bad request' } } })
    const store = useAgentsStore()
    await expect(store.createAgent({})).rejects.toBeTruthy()
    expect(mockNotify.error).toHaveBeenCalledWith('Bad request')
  })

  test('updateAgent updates in store', async () => {
    mockApi.get.mockResolvedValue({ data: [{ id: 'a1', name: 'Old' }] })
    const store = useAgentsStore()
    await store.loadAgents()
    mockApi.put.mockResolvedValue({ data: { id: 'a1', name: 'New' } })
    await store.updateAgent('a1', { name: 'New' })
    expect(store.agents.find(a => a.id === 'a1').name).toBe('New')
  })

  test('updateAgent shows notification on failure', async () => {
    mockApi.put.mockRejectedValue({ response: { data: { error: 'Err' } } })
    const store = useAgentsStore()
    await expect(store.updateAgent('a1', {})).rejects.toBeTruthy()
    expect(mockNotify.error).toHaveBeenCalledWith('Err')
  })

  test('deleteAgent removes from store', async () => {
    mockApi.get.mockResolvedValue({ data: [{ id: 'a1' }] })
    const store = useAgentsStore()
    await store.loadAgents()
    mockApi.delete.mockResolvedValue({})
    await store.deleteAgent('a1')
    expect(store.agents).toHaveLength(0)
  })

  test('deleteAgent shows notification on failure', async () => {
    mockApi.delete.mockRejectedValue({ response: { data: { error: 'Denied' } } })
    const store = useAgentsStore()
    await expect(store.deleteAgent('a1')).rejects.toBeTruthy()
    expect(mockNotify.error).toHaveBeenCalledWith('Denied')
  })
})
