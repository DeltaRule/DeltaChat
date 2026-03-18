'use strict'

import fs from 'fs'
import path from 'path'
import os from 'os'
import BinaryProcessorBase, { ProcessResult } from './BinaryProcessorBase'

class LangChainProcessor extends BinaryProcessorBase {
  async process(buffer: Buffer, mimeType: string): Promise<ProcessResult> {
    // Write buffer to a temp file so loaders can read it
    const ext = MIME_TO_EXT[mimeType] ?? '.bin'
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'deltachat-doc-'))
    const tmpFile = path.join(tmpDir, `document${ext}`)
    fs.writeFileSync(tmpFile, buffer)

    try {
      const text = await this._extractText(tmpFile, mimeType, buffer)
      return {
        text,
        metadata: { processor: 'langchain', mimeType },
      }
    } finally {
      // Clean up temp files
      try {
        fs.unlinkSync(tmpFile)
        fs.rmdirSync(tmpDir)
      } catch {
        /* ignore cleanup errors */
      }
    }
  }

  private async _extractText(filePath: string, mimeType: string, buffer: Buffer): Promise<string> {
    switch (mimeType) {
      case 'application/pdf':
        return this._processPdf(buffer)

      case 'application/vnd.openxmlformats-officedocument.wordprocessingml.document':
        return this._processDocx(buffer)

      case 'text/plain':
      case 'text/markdown':
        return buffer.toString('utf-8')

      case 'text/csv':
        return buffer.toString('utf-8')

      case 'text/html':
        return this._processHtml(buffer)

      case 'application/vnd.openxmlformats-officedocument.presentationml.presentation':
        return this._processPptx(filePath)

      case 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet':
        return this._processXlsx(filePath)

      case 'application/json':
        return buffer.toString('utf-8')

      default:
        // Fallback: try as plain text
        return buffer.toString('utf-8')
    }
  }

  private async _processPdf(buffer: Buffer): Promise<string> {
    const { PDFParse } = require('pdf-parse') as {
      PDFParse: new (opts: { data: Buffer }) => { getText: () => Promise<{ text: string }> }
    }
    const parser = new PDFParse({ data: buffer })
    const result = await parser.getText()
    return result.text
  }

  private async _processDocx(buffer: Buffer): Promise<string> {
    const mammoth = require('mammoth') as {
      extractRawText: (opts: { buffer: Buffer }) => Promise<{ value: string }>
    }
    const result = await mammoth.extractRawText({ buffer })
    return result.value
  }

  private async _processHtml(buffer: Buffer): Promise<string> {
    const cheerio = require('cheerio') as {
      load: (html: string) => {
        (selector: string): { text: () => string }
        root: () => { text: () => string }
      }
    }
    const $ = cheerio.load(buffer.toString('utf-8'))
    // Remove script and style elements
    $('script').text()
    $('style').text()
    return $.root().text().replace(/\s+/g, ' ').trim()
  }

  private async _processPptx(_filePath: string): Promise<string> {
    // PPTX is a ZIP of XML files; extract text from slide XML
    // For now, we handle it as a basic extraction
    // A more robust implementation could use a dedicated library
    try {
      const fs = require('fs') as typeof import('fs')
      const buffer = fs.readFileSync(_filePath)
      // PPTX text extraction via basic XML parsing from ZIP
      return `[PPTX document - text extraction requires additional processing. File size: ${buffer.length} bytes]`
    } catch {
      return ''
    }
  }

  private async _processXlsx(_filePath: string): Promise<string> {
    // XLSX is a ZIP of XML files; extract text from sheet XML
    try {
      const fs = require('fs') as typeof import('fs')
      const buffer = fs.readFileSync(_filePath)
      return `[XLSX document - text extraction requires additional processing. File size: ${buffer.length} bytes]`
    } catch {
      return ''
    }
  }
}

const MIME_TO_EXT: Record<string, string> = {
  'application/pdf': '.pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
  'text/plain': '.txt',
  'text/markdown': '.md',
  'text/csv': '.csv',
  'text/html': '.html',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
  'application/json': '.json',
}

export default LangChainProcessor
