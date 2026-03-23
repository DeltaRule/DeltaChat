'use strict'

import BinaryStorageBase, { StoreResult, RetrieveResult, DeleteResult } from './BinaryStorageBase'
import config from '../../config'

interface GCSBinaryStorageOpts {
  projectId?: string
  bucket: string
  keyFilename?: string
}

class GCSBinaryStorage extends BinaryStorageBase {
  private _bucket: any = null
  private _opts: GCSBinaryStorageOpts

  constructor(opts: GCSBinaryStorageOpts) {
    super()
    this._opts = opts
  }

  private async _getBucket(): Promise<any> {
    if (!this._bucket) {
      const { Storage } = require('@google-cloud/storage') as any
      const storage = new Storage({
        ...(this._opts.projectId ? { projectId: this._opts.projectId } : {}),
        ...(this._opts.keyFilename ? { keyFilename: this._opts.keyFilename } : {}),
      })
      this._bucket = storage.bucket(this._opts.bucket ?? config.gcs.bucket)
    }
    return this._bucket
  }

  async store(id: string, buffer: Buffer, metadata: Record<string, unknown>): Promise<StoreResult> {
    const bucket = await this._getBucket()

    // Store binary
    const file = bucket.file(id)
    await file.save(buffer)

    // Store metadata
    const metaObj = { id, size: buffer.length, storedAt: new Date().toISOString(), ...metadata }
    const metaFile = bucket.file(`${id}.meta`)
    await metaFile.save(JSON.stringify(metaObj), { contentType: 'application/json' })

    return { id, size: buffer.length, metadata: metaObj }
  }

  async retrieve(id: string): Promise<RetrieveResult> {
    const bucket = await this._getBucket()
    const file = bucket.file(id)
    const [buffer] = await file.download()

    let metadata: Record<string, unknown> = {}
    try {
      const metaFile = bucket.file(`${id}.meta`)
      const [metaBuffer] = await metaFile.download()
      metadata = JSON.parse(metaBuffer.toString('utf-8')) as Record<string, unknown>
    } catch {
      // metadata may not exist
    }

    return { buffer, metadata }
  }

  async delete(id: string): Promise<DeleteResult> {
    const bucket = await this._getBucket()
    const file = bucket.file(id)
    await file.delete({ ignoreNotFound: true })
    const metaFile = bucket.file(`${id}.meta`)
    await metaFile.delete({ ignoreNotFound: true })
    return { ok: true }
  }

  async list(): Promise<StoreResult[]> {
    const bucket = await this._getBucket()
    const [files] = await bucket.getFiles()
    const results: StoreResult[] = []

    for (const file of files) {
      if (file.name.endsWith('.meta')) continue

      let metadata: Record<string, unknown> = {}
      try {
        const metaFile = bucket.file(`${file.name}.meta`)
        const [metaBuffer] = await metaFile.download()
        metadata = JSON.parse(metaBuffer.toString('utf-8')) as Record<string, unknown>
      } catch {
        // ignore
      }

      results.push({
        id: file.name,
        size: Number(file.metadata.size ?? 0),
        metadata,
      })
    }

    return results
  }
}

export default GCSBinaryStorage
