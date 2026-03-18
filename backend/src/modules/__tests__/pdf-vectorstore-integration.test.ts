'use strict'

import fs from 'fs'
import path from 'path'
import os from 'os'
import LangChainProcessor from '../BinaryProcessor/LangChainProcessor'
import LocalVectorStore from '../VectorStore/LocalVectorStore'

const FIXTURES_DIR = path.resolve(__dirname, '../../../data/test-fixtures')
const SAMPLE_PDF = path.join(FIXTURES_DIR, 'pdf-sample_0.pdf')

/**
 * Integration test: process a real PDF and store/query chunks in LocalVectorStore.
 * Uses a trivial mock embedding (character-frequency vector) to avoid needing an
 * actual embedding provider.
 */

function charFreqVector(text: string, dims = 26): number[] {
  const vec = new Array<number>(dims).fill(0)
  for (const ch of text.toLowerCase()) {
    const code = ch.charCodeAt(0) - 97 // a=0, b=1, ...
    if (code >= 0 && code < dims) vec[code]!++
  }
  // Normalize
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0))
  return norm === 0 ? vec : vec.map((v) => v / norm)
}

function chunkText(text: string, maxLen = 500, overlap = 50): string[] {
  const chunks: string[] = []
  let start = 0
  while (start < text.length) {
    chunks.push(text.slice(start, Math.min(start + maxLen, text.length)))
    start += maxLen - overlap
  }
  return chunks
}

describe('PDF-to-VectorStore integration', () => {
  let processor: LangChainProcessor
  let store: LocalVectorStore
  let tmpDir: string

  beforeAll(() => {
    if (!fs.existsSync(SAMPLE_PDF)) {
      throw new Error(`Test fixture missing: ${SAMPLE_PDF}`)
    }
    processor = new LangChainProcessor()
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deltachat-integ-'))
    store = new LocalVectorStore({ dataDir: tmpDir, defaultCollection: 'integ-test' })
  })

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true })
  })

  test('extracts text from PDF, chunks it, indexes, and queries', async () => {
    // Step 1: Process PDF
    const buffer = fs.readFileSync(SAMPLE_PDF)
    const result = await processor.process(buffer, 'application/pdf')
    expect(result.text.length).toBeGreaterThan(0)

    // Step 2: Chunk the text
    const chunks = chunkText(result.text, 500, 50)
    expect(chunks.length).toBeGreaterThan(0)

    // Step 3: Index chunks into vector store
    for (let i = 0; i < chunks.length; i++) {
      const vector = charFreqVector(chunks[i]!)
      await store.upsert(`doc1::${i}`, vector, {
        text: chunks[i],
        docId: 'doc1',
        chunkIndex: i,
      })
    }

    // Step 4: Query with a vector derived from a string
    const queryVec = charFreqVector(result.text.slice(0, 200))
    const results = await store.query(queryVec, 3)

    expect(results.length).toBeGreaterThan(0)
    expect(results[0]!.score).toBeGreaterThan(0)
    expect(results[0]!.metadata).toHaveProperty('text')
    expect(results[0]!.metadata).toHaveProperty('docId', 'doc1')
  })

  test('can delete indexed chunks', async () => {
    const buffer = fs.readFileSync(SAMPLE_PDF)
    const result = await processor.process(buffer, 'application/pdf')
    const chunks = chunkText(result.text, 500, 50)

    // Delete all chunks
    for (let i = 0; i < chunks.length; i++) {
      await store.delete(`doc1::${i}`)
    }

    const queryVec = charFreqVector('test query')
    const results = await store.query(queryVec, 5)
    expect(results).toHaveLength(0)
  })
})
