'use strict'

import fs from 'fs'
import path from 'path'
import LangChainProcessor from '../LangChainProcessor'

const FIXTURES_DIR = path.resolve(__dirname, '../../../../data/test-fixtures')
const SAMPLE_PDF = path.join(FIXTURES_DIR, 'pdf-sample_0.pdf')

describe('LangChainProcessor', () => {
  let processor: LangChainProcessor

  beforeAll(() => {
    if (!fs.existsSync(SAMPLE_PDF)) {
      throw new Error(
        `Test fixture not found: ${SAMPLE_PDF}. Place pdf-sample_0.pdf in backend/data/test-fixtures/`,
      )
    }
    processor = new LangChainProcessor()
  })

  test('extracts text from a PDF file', async () => {
    const buffer = fs.readFileSync(SAMPLE_PDF)
    const result = await processor.process(buffer, 'application/pdf')

    expect(result).toHaveProperty('text')
    expect(result).toHaveProperty('metadata')
    expect(typeof result.text).toBe('string')
    expect(result.text.length).toBeGreaterThan(0)
    expect(result.metadata).toMatchObject({ processor: 'langchain', mimeType: 'application/pdf' })
  })

  test('processes plain text', async () => {
    const text = 'Hello, this is a test document for DeltaChat.'
    const buffer = Buffer.from(text, 'utf-8')
    const result = await processor.process(buffer, 'text/plain')

    expect(result.text).toBe(text)
    expect(result.metadata).toMatchObject({ processor: 'langchain', mimeType: 'text/plain' })
  })

  test('processes markdown', async () => {
    const md = '# Title\n\nSome **bold** text.\n'
    const buffer = Buffer.from(md, 'utf-8')
    const result = await processor.process(buffer, 'text/markdown')

    expect(result.text).toBe(md)
    expect(result.metadata.mimeType).toBe('text/markdown')
  })

  test('processes JSON', async () => {
    const json = JSON.stringify({ key: 'value', nested: { a: 1 } })
    const buffer = Buffer.from(json, 'utf-8')
    const result = await processor.process(buffer, 'application/json')

    expect(result.text).toBe(json)
  })

  test('falls back to plain text for unknown types', async () => {
    const content = 'unknown content type'
    const buffer = Buffer.from(content, 'utf-8')
    const result = await processor.process(buffer, 'application/octet-stream')

    expect(result.text).toBe(content)
  })
})
