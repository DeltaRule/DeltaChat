'use strict'

import 'dotenv/config'

import express, { Request, Response, NextFunction } from 'express'
import helmet from 'helmet'
import cors from 'cors'
import morgan from 'morgan'
import config from './config'
import logger from './logger'
import apiRouter from './routes'
import scimRouter from './routes/scim'

interface AppError extends Error {
  status?: number
  statusCode?: number
  stack?: string
}

const app = express()

// ── Security & utility middleware ──────────────────────────────────────────

app.use(helmet())

app.use(
  cors({
    origin: config.cors.origins as string[],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
)

if (config.nodeEnv !== 'test') {
  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'))
}

app.use(express.json({ limit: '50mb' }))
app.use(express.urlencoded({ extended: true, limit: '50mb' }))

// ── Health check ───────────────────────────────────────────────────────────

app.get('/health', (_req: Request, res: Response) => {
  const { getAdapter } = require('./db/DeltaDatabaseAdapter') as {
    getAdapter: () => { mode: string }
  }
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    dbMode: getAdapter().mode,
  })
})

// ── API routes ─────────────────────────────────────────────────────────────

app.use('/api', apiRouter)

// ── SCIM 2.0 provisioning (RFC 7644) ──────────────────────────────────────

app.use('/scim/v2', scimRouter)

// ── 404 handler ────────────────────────────────────────────────────────────

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` })
})

// ── Global error handler ───────────────────────────────────────────────────

app.use((err: AppError, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status ?? err.statusCode ?? 500
  const message = err.message ?? 'Internal Server Error'

  if (status >= 500) {
    logger.error('[Error]', err)
  }

  res.status(status).json({
    error: message,
    ...(config.nodeEnv !== 'production' && status >= 500 ? { stack: err.stack } : {}),
  })
})

export default app
