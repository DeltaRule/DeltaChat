'use strict'

export interface ProcessResult {
  text: string
  metadata: Record<string, unknown>
}

abstract class BinaryProcessorBase {
  abstract process(buffer: Buffer, mimeType: string): Promise<ProcessResult>
}

export default BinaryProcessorBase
