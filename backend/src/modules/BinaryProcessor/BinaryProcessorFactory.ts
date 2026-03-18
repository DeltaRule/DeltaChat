'use strict'

import BinaryProcessorBase from './BinaryProcessorBase'
import config from '../../config'

export interface BinaryProcessorConfig {
  type: 'langchain' | 'tika' | 'docling'
  url?: string
}

const _instances = new Map<string, BinaryProcessorBase>()

function configKey(cfg: BinaryProcessorConfig): string {
  return JSON.stringify({ type: cfg.type, url: cfg.url })
}

export function createBinaryProcessor(cfg: BinaryProcessorConfig): BinaryProcessorBase {
  const key = configKey(cfg)
  const cached = _instances.get(key)
  if (cached) return cached

  let instance: BinaryProcessorBase

  switch (cfg.type) {
    case 'tika': {
      const TikaProcessor = require('./TikaProcessor').default as new (opts: {
        url: string
      }) => BinaryProcessorBase
      instance = new TikaProcessor({ url: cfg.url ?? config.tika.url })
      break
    }
    case 'docling': {
      const DoclingProcessor = require('./DoclingProcessor').default as new (opts: {
        url: string
      }) => BinaryProcessorBase
      instance = new DoclingProcessor({ url: cfg.url ?? config.docling.url })
      break
    }
    case 'langchain':
    default: {
      const LangChainProcessor = require('./LangChainProcessor')
        .default as new () => BinaryProcessorBase
      instance = new LangChainProcessor()
      break
    }
  }

  _instances.set(key, instance)
  return instance
}

export function clearBinaryProcessorCache(): void {
  _instances.clear()
}
