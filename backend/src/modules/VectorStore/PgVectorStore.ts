'use strict'

import VectorStoreBase, { VectorResult } from './VectorStoreBase'
import config from '../../config'

interface PgVectorStoreOpts {
  connectionString?: string
  tableName?: string
}

class PgVectorStore extends VectorStoreBase {
  private _pool: any = null
  private _connectionString: string
  private _tableName: string

  constructor(opts: PgVectorStoreOpts = {}) {
    super()
    this._connectionString = opts.connectionString ?? config.pgvector.connectionString
    this._tableName = opts.tableName ?? 'vectors'
  }

  private async _getPool(): Promise<any> {
    if (!this._pool) {
      const { Pool } = require('pg') as any
      this._pool = new Pool({ connectionString: this._connectionString })
      // Ensure pgvector extension exists
      await this._pool.query('CREATE EXTENSION IF NOT EXISTS vector')
    }
    return this._pool
  }

  private _safeTable(name: string): string {
    return name.replace(/[^a-zA-Z0-9_]/g, '_')
  }

  async useCollection(name: string): Promise<void> {
    this._tableName = this._safeTable(name)
  }

  async upsert(
    id: string,
    vector: number[],
    metadata: Record<string, unknown>,
  ): Promise<{ id: string }> {
    const pool = await this._getPool()
    const table = this._safeTable(this._tableName)
    const vectorStr = `[${vector.join(',')}]`
    await pool.query(
      `INSERT INTO ${table} (id, embedding, metadata)
       VALUES ($1, $2::vector, $3)
       ON CONFLICT (id) DO UPDATE SET embedding = $2::vector, metadata = $3`,
      [id, vectorStr, JSON.stringify(metadata)],
    )
    return { id }
  }

  async query(
    vector: number[],
    topK: number,
    _filter?: Record<string, unknown>,
  ): Promise<VectorResult[]> {
    const pool = await this._getPool()
    const table = this._safeTable(this._tableName)
    const vectorStr = `[${vector.join(',')}]`
    const { rows } = await pool.query(
      `SELECT id, metadata, 1 - (embedding <=> $1::vector) AS score
       FROM ${table}
       ORDER BY embedding <=> $1::vector
       LIMIT $2`,
      [vectorStr, topK],
    )
    return rows.map(
      (r: { id: string; score: number; metadata: string | Record<string, unknown> }) => ({
        id: r.id,
        score: r.score,
        metadata: typeof r.metadata === 'string' ? JSON.parse(r.metadata) : r.metadata,
      }),
    )
  }

  async delete(id: string): Promise<{ ok: boolean }> {
    const pool = await this._getPool()
    const table = this._safeTable(this._tableName)
    await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id])
    return { ok: true }
  }

  async createCollection(name: string): Promise<{ name: string }> {
    const pool = await this._getPool()
    const table = this._safeTable(name)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id TEXT PRIMARY KEY,
        embedding vector(1536),
        metadata JSONB DEFAULT '{}'
      )
    `)
    await pool.query(
      `CREATE INDEX IF NOT EXISTS idx_${table}_embedding ON ${table} USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100)`,
    )
    this._tableName = table
    return { name: table }
  }

  async deleteCollection(name: string): Promise<{ ok: boolean }> {
    const pool = await this._getPool()
    const table = this._safeTable(name)
    await pool.query(`DROP TABLE IF EXISTS ${table}`)
    return { ok: true }
  }
}

export default PgVectorStore
