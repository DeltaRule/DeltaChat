'use strict'

abstract class EmbeddingProviderBase {
  abstract embed(text: string): Promise<number[]>

  abstract embedBatch(texts: string[]): Promise<number[][]>

  abstract getDimensions(): number
}

export default EmbeddingProviderBase
