'use strict';

abstract class EmbeddingProviderBase {
  async embed(_text: string): Promise<number[]> {
    throw new Error(`${this.constructor.name} must implement embed(text)`);
  }

  async embedBatch(_texts: string[]): Promise<number[][]> {
    throw new Error(`${this.constructor.name} must implement embedBatch(texts)`);
  }

  getDimensions(): number {
    throw new Error(`${this.constructor.name} must implement getDimensions()`);
  }
}

export default EmbeddingProviderBase;
