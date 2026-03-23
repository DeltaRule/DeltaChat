'use strict'

import axios from 'axios'
import FormData from 'form-data'
import BinaryProcessorBase, { ProcessResult } from './BinaryProcessorBase'
import config from '../../config'

interface UnstructuredProcessorOpts {
  url?: string
  apiKey?: string
}

interface UnstructuredElement {
  type: string
  text: string
  metadata?: {
    page_number?: number
    filename?: string
    filetype?: string
    languages?: string[]
    [key: string]: unknown
  }
}

class UnstructuredProcessor extends BinaryProcessorBase {
  private _url: string
  private _apiKey: string

  constructor(opts: UnstructuredProcessorOpts = {}) {
    super()
    this._url = (opts.url ?? config.unstructured.url).replace(/\/$/, '')
    this._apiKey = opts.apiKey ?? config.unstructured.apiKey
  }

  async process(buffer: Buffer, mimeType: string): Promise<ProcessResult> {
    const form = new FormData()
    const ext = this._mimeToExtension(mimeType)
    form.append('files', buffer, { filename: `document${ext}`, contentType: mimeType })
    form.append('strategy', 'auto')

    const headers: Record<string, string> = {
      ...form.getHeaders(),
    }
    if (this._apiKey) {
      headers['unstructured-api-key'] = this._apiKey
    }

    const { data } = await axios.post<UnstructuredElement[]>(
      `${this._url}/general/v0/general`,
      form,
      { headers, timeout: 300000, maxContentLength: Infinity, maxBodyLength: Infinity },
    )

    const elements = Array.isArray(data) ? data : []
    const text = elements.map((el) => el.text).join('\n\n')

    const elementTypes = new Set(elements.map((el) => el.type))
    const pages = new Set(
      elements.map((el) => el.metadata?.page_number).filter((p) => p !== undefined),
    )
    const languages = new Set(elements.flatMap((el) => el.metadata?.languages ?? []))

    return {
      text,
      metadata: {
        processor: 'unstructured',
        elementCount: elements.length,
        elementTypes: [...elementTypes],
        pageCount: pages.size,
        languages: [...languages],
        mimeType,
      },
    }
  }

  private _mimeToExtension(mimeType: string): string {
    const map: Record<string, string> = {
      'application/pdf': '.pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation': '.pptx',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
      'application/msword': '.doc',
      'application/vnd.ms-excel': '.xls',
      'application/vnd.ms-powerpoint': '.ppt',
      'text/plain': '.txt',
      'text/markdown': '.md',
      'text/csv': '.csv',
      'text/html': '.html',
      'text/xml': '.xml',
      'application/json': '.json',
      'application/rtf': '.rtf',
      'application/epub+zip': '.epub',
      'message/rfc822': '.eml',
      'application/vnd.oasis.opendocument.text': '.odt',
      'application/vnd.oasis.opendocument.spreadsheet': '.ods',
      'application/vnd.oasis.opendocument.presentation': '.odp',
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/tiff': '.tiff',
      'image/bmp': '.bmp',
    }
    return map[mimeType] ?? '.bin'
  }
}

export default UnstructuredProcessor
