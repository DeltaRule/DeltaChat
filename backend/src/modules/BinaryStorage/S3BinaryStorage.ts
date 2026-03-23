'use strict'

import BinaryStorageBase, { StoreResult, RetrieveResult, DeleteResult } from './BinaryStorageBase'

interface S3BinaryStorageOpts {
  bucket: string
  region?: string
  endpoint?: string
  accessKeyId?: string
  secretAccessKey?: string
}

class S3BinaryStorage extends BinaryStorageBase {
  private _client: any = null
  private _bucket: string
  private _opts: S3BinaryStorageOpts

  constructor(opts: S3BinaryStorageOpts) {
    super()
    this._bucket = opts.bucket
    this._opts = opts
  }

  private async _getClient(): Promise<any> {
    if (!this._client) {
      const { S3Client } = require('@aws-sdk/client-s3') as any
      this._client = new S3Client({
        region: this._opts.region ?? 'us-east-1',
        ...(this._opts.endpoint ? { endpoint: this._opts.endpoint, forcePathStyle: true } : {}),
        ...(this._opts.accessKeyId && this._opts.secretAccessKey
          ? {
              credentials: {
                accessKeyId: this._opts.accessKeyId,
                secretAccessKey: this._opts.secretAccessKey,
              },
            }
          : {}),
      })
    }
    return this._client
  }

  async store(id: string, buffer: Buffer, metadata: Record<string, unknown>): Promise<StoreResult> {
    const client = await this._getClient()
    const { PutObjectCommand } = require('@aws-sdk/client-s3') as any

    // Store the binary
    await client.send(
      new PutObjectCommand({
        Bucket: this._bucket,
        Key: id,
        Body: buffer,
        Metadata: { meta: JSON.stringify(metadata) },
      }),
    )

    // Store metadata as separate JSON object
    const metaObj = { id, size: buffer.length, storedAt: new Date().toISOString(), ...metadata }
    await client.send(
      new PutObjectCommand({
        Bucket: this._bucket,
        Key: `${id}.meta`,
        Body: Buffer.from(JSON.stringify(metaObj), 'utf-8'),
        ContentType: 'application/json',
      }),
    )

    return { id, size: buffer.length, metadata: metaObj }
  }

  async retrieve(id: string): Promise<RetrieveResult> {
    const client = await this._getClient()
    const { GetObjectCommand } = require('@aws-sdk/client-s3') as any

    const response = await client.send(new GetObjectCommand({ Bucket: this._bucket, Key: id }))

    const chunks: Buffer[] = []
    const stream = response.Body as NodeJS.ReadableStream
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as unknown as Uint8Array))
    }
    const buffer = Buffer.concat(chunks)

    let metadata: Record<string, unknown> = {}
    try {
      const metaResponse = await client.send(
        new GetObjectCommand({ Bucket: this._bucket, Key: `${id}.meta` }),
      )
      const metaChunks: Buffer[] = []
      const metaStream = metaResponse.Body as NodeJS.ReadableStream
      for await (const chunk of metaStream) {
        metaChunks.push(
          Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as unknown as Uint8Array),
        )
      }
      metadata = JSON.parse(Buffer.concat(metaChunks).toString('utf-8')) as Record<string, unknown>
    } catch {
      // metadata file may not exist
    }

    return { buffer, metadata }
  }

  async delete(id: string): Promise<DeleteResult> {
    const client = await this._getClient()
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3') as any

    await client.send(new DeleteObjectCommand({ Bucket: this._bucket, Key: id }))
    try {
      await client.send(new DeleteObjectCommand({ Bucket: this._bucket, Key: `${id}.meta` }))
    } catch {
      // ignore
    }
    return { ok: true }
  }

  async list(): Promise<StoreResult[]> {
    const client = await this._getClient()
    const { ListObjectsV2Command, GetObjectCommand } = require('@aws-sdk/client-s3') as any

    const response = await client.send(new ListObjectsV2Command({ Bucket: this._bucket }))

    const results: StoreResult[] = []
    for (const obj of response.Contents ?? []) {
      const key = obj.Key ?? ''
      if (key.endsWith('.meta')) continue

      let metadata: Record<string, unknown> = {}
      try {
        const metaResponse = await client.send(
          new GetObjectCommand({ Bucket: this._bucket, Key: `${key}.meta` }),
        )
        const chunks: Buffer[] = []
        const stream = metaResponse.Body as NodeJS.ReadableStream
        for await (const chunk of stream) {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as unknown as Uint8Array))
        }
        metadata = JSON.parse(Buffer.concat(chunks).toString('utf-8')) as Record<string, unknown>
      } catch {
        // ignore
      }

      results.push({
        id: key,
        size: obj.Size ?? 0,
        metadata,
      })
    }

    return results
  }
}

export default S3BinaryStorage
