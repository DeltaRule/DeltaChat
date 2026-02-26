'use strict';

export interface ProcessResult {
  text: string;
  metadata: Record<string, unknown>;
}

abstract class BinaryProcessorBase {
  async process(_buffer: Buffer, _mimeType: string): Promise<ProcessResult> {
    throw new Error(`${this.constructor.name} must implement process(buffer, mimeType)`);
  }
}

export default BinaryProcessorBase;
