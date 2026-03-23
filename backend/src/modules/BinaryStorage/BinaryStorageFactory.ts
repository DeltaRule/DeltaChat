'use strict'

import BinaryStorageBase from './BinaryStorageBase'
import config from '../../config'

export interface BinaryStorageConfig {
  type: 'local' | 's3' | 'azure' | 'gcs'
  bucket?: string
  region?: string
  endpoint?: string
  accessKeyId?: string
  secretAccessKey?: string
  connectionString?: string
  containerName?: string
  projectId?: string
  keyFilename?: string
}

const _instances = new Map<string, BinaryStorageBase>()

function configKey(cfg: BinaryStorageConfig): string {
  return JSON.stringify({
    type: cfg.type,
    bucket: cfg.bucket,
    endpoint: cfg.endpoint,
    containerName: cfg.containerName,
  })
}

export function createBinaryStorage(cfg: BinaryStorageConfig): BinaryStorageBase {
  const key = configKey(cfg)
  const cached = _instances.get(key)
  if (cached) return cached

  let instance: BinaryStorageBase

  switch (cfg.type) {
    case 's3': {
      const S3BinaryStorage = require('./S3BinaryStorage').default as new (opts: {
        bucket: string
        region?: string
        endpoint?: string
        accessKeyId?: string
        secretAccessKey?: string
      }) => BinaryStorageBase
      instance = new S3BinaryStorage({
        bucket: cfg.bucket ?? 'deltachat-binaries',
        region: cfg.region,
        endpoint: cfg.endpoint,
        accessKeyId: cfg.accessKeyId,
        secretAccessKey: cfg.secretAccessKey,
      })
      break
    }
    case 'azure': {
      const AzureBlobStorage = require('./AzureBlobStorage').default as new (opts: {
        connectionString: string
        containerName?: string
      }) => BinaryStorageBase
      instance = new AzureBlobStorage({
        connectionString: cfg.connectionString ?? config.azureBlob.connectionString,
        containerName: cfg.containerName ?? config.azureBlob.containerName,
      })
      break
    }
    case 'gcs': {
      const GCSBinaryStorage = require('./GCSBinaryStorage').default as new (opts: {
        projectId?: string
        bucket: string
        keyFilename?: string
      }) => BinaryStorageBase
      instance = new GCSBinaryStorage({
        projectId: cfg.projectId,
        bucket: cfg.bucket ?? 'deltachat-binaries',
        keyFilename: cfg.keyFilename,
      })
      break
    }
    case 'local':
    default: {
      const LocalBinaryStorage = require('./LocalBinaryStorage')
        .default as new () => BinaryStorageBase
      instance = new LocalBinaryStorage()
      break
    }
  }

  _instances.set(key, instance)
  return instance
}

export function clearBinaryStorageCache(): void {
  _instances.clear()
}
