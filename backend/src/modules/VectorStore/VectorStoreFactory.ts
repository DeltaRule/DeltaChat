'use strict';

import VectorStoreBase from './VectorStoreBase';
import config from '../../config';

export interface VectorStoreConfig {
  type: 'local' | 'chroma';
  url?: string;
  path?: string;
  collection?: string;
}

const _instances = new Map<string, VectorStoreBase>();

function configKey(cfg: VectorStoreConfig): string {
  return JSON.stringify({ type: cfg.type, url: cfg.url, path: cfg.path });
}

export function createVectorStore(cfg: VectorStoreConfig): VectorStoreBase {
  const key = configKey(cfg);
  const cached = _instances.get(key);
  if (cached) return cached;

  let instance: VectorStoreBase;

  switch (cfg.type) {
    case 'chroma': {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const ChromaVectorStore = require('./ChromaVectorStore').default as new (opts: {
        url?: string;
        defaultCollection?: string;
      }) => VectorStoreBase;
      instance = new ChromaVectorStore({
        url: cfg.url ?? config.chroma.url,
        defaultCollection: cfg.collection ?? config.chroma.defaultCollection,
      });
      break;
    }
    case 'local':
    default: {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const LocalVectorStore = require('./LocalVectorStore').default as new (opts: {
        dataDir?: string;
        defaultCollection?: string;
      }) => VectorStoreBase;
      instance = new LocalVectorStore({
        dataDir: cfg.path,
        defaultCollection: cfg.collection,
      });
      break;
    }
  }

  _instances.set(key, instance);
  return instance;
}

export function clearVectorStoreCache(): void {
  _instances.clear();
}
