import { describe, test, expect, beforeEach } from 'vitest'
import { mockApi, mockNotify, setupStoreTest } from './setup'
import { useModelsStore } from '../models'

describe('models store', () => {
  beforeEach(() => setupStoreTest())

  test('loadModels populates aiModels on success', async () => {
    mockApi.get.mockResolvedValue({ data: [{ id: 'm1', name: 'GPT-4' }] })
    const store = useModelsStore()
    await store.loadModels()
    expect(store.aiModels).toEqual([{ id: 'm1', name: 'GPT-4' }])
  })

  test('loadModels shows notification on failure', async () => {
    mockApi.get.mockRejectedValue({ response: { data: { error: 'Server error' } } })
    const store = useModelsStore()
    await store.loadModels()
    expect(mockNotify.error).toHaveBeenCalledWith('Server error')
  })

  test('createModel adds model to store on success', async () => {
    mockApi.post.mockResolvedValue({ data: { id: 'm2', name: 'Claude' } })
    const store = useModelsStore()
    const result = await store.createModel({ name: 'Claude' })
    expect(result).toEqual({ id: 'm2', name: 'Claude' })
    expect(store.aiModels).toContainEqual({ id: 'm2', name: 'Claude' })
  })

  test('createModel shows notification on failure', async () => {
    mockApi.post.mockRejectedValue({ response: { data: { error: 'Forbidden' } } })
    const store = useModelsStore()
    await expect(store.createModel({ name: 'Fail' })).rejects.toBeTruthy()
    expect(mockNotify.error).toHaveBeenCalledWith('Forbidden')
  })

  test('updateModel updates model in store on success', async () => {
    mockApi.get.mockResolvedValue({ data: [{ id: 'm1', name: 'Old' }] })
    const store = useModelsStore()
    await store.loadModels()
    mockApi.put.mockResolvedValue({ data: { id: 'm1', name: 'New' } })
    await store.updateModel('m1', { name: 'New' })
    expect(store.aiModels.find((m) => m.id === 'm1')!.name).toBe('New')
  })

  test('updateModel shows notification on failure', async () => {
    mockApi.put.mockRejectedValue({ response: { data: { error: 'Not found' } } })
    const store = useModelsStore()
    await expect(store.updateModel('m1', {})).rejects.toBeTruthy()
    expect(mockNotify.error).toHaveBeenCalledWith('Not found')
  })

  test('deleteModel removes model from store on success', async () => {
    mockApi.get.mockResolvedValue({ data: [{ id: 'm1', name: 'GPT-4' }] })
    const store = useModelsStore()
    await store.loadModels()
    mockApi.delete.mockResolvedValue({})
    await store.deleteModel('m1')
    expect(store.aiModels).toHaveLength(0)
  })

  test('deleteModel shows notification on failure', async () => {
    mockApi.delete.mockRejectedValue({ response: { data: { error: 'Cannot delete' } } })
    const store = useModelsStore()
    await expect(store.deleteModel('m1')).rejects.toBeTruthy()
    expect(mockNotify.error).toHaveBeenCalledWith('Cannot delete')
  })
})
