'use strict'

import fs from 'fs'
import path from 'path'
import os from 'os'
import LocalVectorStore from '../LocalVectorStore'

describe('LocalVectorStore', () => {
  let store: LocalVectorStore
  let tmpDir: string

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deltachat-vs-test-'))
    store = new LocalVectorStore({ dataDir: tmpDir, defaultCollection: 'test-collection' })
  })

  afterEach(() => {
    // Cleanup temp directory
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('createCollection', () => {
    test('creates a collection file on disk', async () => {
      await store.createCollection('my-col')
      const filePath = path.join(tmpDir, 'my-col.json')
      expect(fs.existsSync(filePath)).toBe(true)
    })
  })

  describe('upsert', () => {
    test('inserts a new vector', async () => {
      const result = await store.upsert('v1', [1, 0, 0], { text: 'hello' })
      expect(result).toEqual({ id: 'v1' })
    })

    test('updates an existing vector', async () => {
      await store.upsert('v1', [1, 0, 0], { text: 'first' })
      await store.upsert('v1', [0, 1, 0], { text: 'updated' })

      const results = await store.query([0, 1, 0], 5)
      expect(results).toHaveLength(1)
      expect(results[0]!.metadata['text']).toBe('updated')
    })
  })

  describe('query', () => {
    beforeEach(async () => {
      // Insert vectors in different directions
      await store.upsert('v1', [1, 0, 0], { text: 'x-axis', category: 'A' })
      await store.upsert('v2', [0, 1, 0], { text: 'y-axis', category: 'B' })
      await store.upsert('v3', [0, 0, 1], { text: 'z-axis', category: 'A' })
      await store.upsert('v4', [0.7, 0.7, 0], { text: 'xy-diagonal', category: 'B' })
    })

    test('returns results sorted by cosine similarity', async () => {
      const results = await store.query([1, 0, 0], 4)
      expect(results[0]!.id).toBe('v1') // exact match
      expect(results[0]!.score).toBeCloseTo(1.0, 5)
      expect(results[1]!.id).toBe('v4') // partial match
    })

    test('respects topK', async () => {
      const results = await store.query([1, 0, 0], 2)
      expect(results).toHaveLength(2)
    })

    test('applies metadata filter', async () => {
      const results = await store.query([1, 0, 0], 10, { category: 'A' })
      expect(results).toHaveLength(2)
      expect(results.every((r) => r.metadata['category'] === 'A')).toBe(true)
    })

    test('returns empty array for empty collection', async () => {
      const emptyStore = new LocalVectorStore({ dataDir: tmpDir, defaultCollection: 'empty' })
      const results = await emptyStore.query([1, 0, 0], 5)
      expect(results).toEqual([])
    })
  })

  describe('delete', () => {
    test('removes a vector by id', async () => {
      await store.upsert('v1', [1, 0, 0], { text: 'hello' })
      await store.upsert('v2', [0, 1, 0], { text: 'world' })

      await store.delete('v1')

      const results = await store.query([1, 0, 0], 5)
      expect(results).toHaveLength(1)
      expect(results[0]!.id).toBe('v2')
    })
  })

  describe('deleteCollection', () => {
    test('removes the collection file', async () => {
      await store.createCollection('to-delete')
      const filePath = path.join(tmpDir, 'to-delete.json')
      expect(fs.existsSync(filePath)).toBe(true)

      await store.deleteCollection('to-delete')
      expect(fs.existsSync(filePath)).toBe(false)
    })
  })

  describe('useCollection', () => {
    test('switches the active collection', async () => {
      await store.createCollection('col-a')
      await store.createCollection('col-b')

      await store.useCollection('col-a')
      await store.upsert('v1', [1, 0, 0], { text: 'in col-a' })

      await store.useCollection('col-b')
      await store.upsert('v2', [0, 1, 0], { text: 'in col-b' })

      // Query col-b should only have v2
      const resultsB = await store.query([0, 1, 0], 5)
      expect(resultsB).toHaveLength(1)
      expect(resultsB[0]!.id).toBe('v2')

      // Switch back to col-a
      await store.useCollection('col-a')
      const resultsA = await store.query([1, 0, 0], 5)
      expect(resultsA).toHaveLength(1)
      expect(resultsA[0]!.id).toBe('v1')
    })
  })

  describe('persistence', () => {
    test('data survives creating a new store instance', async () => {
      await store.upsert('v1', [1, 0, 0], { text: 'persistent' })

      // Create a new store pointing at the same directory
      const store2 = new LocalVectorStore({ dataDir: tmpDir, defaultCollection: 'test-collection' })
      const results = await store2.query([1, 0, 0], 5)
      expect(results).toHaveLength(1)
      expect(results[0]!.metadata['text']).toBe('persistent')
    })
  })
})
