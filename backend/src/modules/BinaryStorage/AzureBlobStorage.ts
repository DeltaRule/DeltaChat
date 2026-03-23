'use strict'

import BinaryStorageBase, { StoreResult, RetrieveResult, DeleteResult } from './BinaryStorageBase'
import config from '../../config'

interface AzureBlobStorageOpts {
  connectionString: string
  containerName?: string
}

class AzureBlobStorage extends BinaryStorageBase {
  private _containerClient: any = null
  private _connectionString: string
  private _containerName: string

  constructor(opts: AzureBlobStorageOpts) {
    super()
    this._connectionString = opts.connectionString ?? config.azureBlob.connectionString
    this._containerName = opts.containerName ?? config.azureBlob.containerName
  }

  private async _getContainer(): Promise<any> {
    if (!this._containerClient) {
      const { BlobServiceClient } = require('@azure/storage-blob') as any
      const serviceClient = BlobServiceClient.fromConnectionString(this._connectionString)
      this._containerClient = serviceClient.getContainerClient(this._containerName)
      await this._containerClient.createIfNotExists()
    }
    return this._containerClient
  }

  async store(id: string, buffer: Buffer, metadata: Record<string, unknown>): Promise<StoreResult> {
    const container = await this._getContainer()

    // Store binary
    const blobClient = container.getBlockBlobClient(id)
    await blobClient.uploadData(buffer, {
      metadata: { storedAt: new Date().toISOString() },
    })

    // Store metadata as separate blob
    const metaObj = { id, size: buffer.length, storedAt: new Date().toISOString(), ...metadata }
    const metaClient = container.getBlockBlobClient(`${id}.meta`)
    await metaClient.uploadData(Buffer.from(JSON.stringify(metaObj)), {
      blobHTTPHeaders: { blobContentType: 'application/json' },
    })

    return { id, size: buffer.length, metadata: metaObj }
  }

  async retrieve(id: string): Promise<RetrieveResult> {
    const container = await this._getContainer()
    const blobClient = container.getBlockBlobClient(id)
    const downloadResponse = await blobClient.downloadToBuffer()

    let metadata: Record<string, unknown> = {}
    try {
      const metaClient = container.getBlockBlobClient(`${id}.meta`)
      const metaBuffer = await metaClient.downloadToBuffer()
      metadata = JSON.parse(metaBuffer.toString('utf-8')) as Record<string, unknown>
    } catch {
      // metadata may not exist
    }

    return { buffer: downloadResponse, metadata }
  }

  async delete(id: string): Promise<DeleteResult> {
    const container = await this._getContainer()
    const blobClient = container.getBlockBlobClient(id)
    await blobClient.deleteIfExists()
    const metaClient = container.getBlockBlobClient(`${id}.meta`)
    await metaClient.deleteIfExists()
    return { ok: true }
  }

  async list(): Promise<StoreResult[]> {
    const container = await this._getContainer()
    const results: StoreResult[] = []

    for await (const blob of container.listBlobsFlat()) {
      if (blob.name.endsWith('.meta')) continue

      let metadata: Record<string, unknown> = {}
      try {
        const metaClient = container.getBlockBlobClient(`${blob.name}.meta`)
        const metaBuffer = await metaClient.downloadToBuffer()
        metadata = JSON.parse(metaBuffer.toString('utf-8')) as Record<string, unknown>
      } catch {
        // ignore
      }

      results.push({
        id: blob.name,
        size: blob.properties.contentLength ?? 0,
        metadata,
      })
    }

    return results
  }
}

export default AzureBlobStorage
