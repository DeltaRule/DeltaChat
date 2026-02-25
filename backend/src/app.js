'use strict';

require('dotenv').config();
require('express-async-errors');

const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const morgan = require('morgan');
const config = require('./config');
const apiRouter = require('./routes');

const app = express();

// ── Security & utility middleware ──────────────────────────────────────────

app.use(helmet());

app.use(
  cors({
    origin: config.cors.origins,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  })
);

if (config.nodeEnv !== 'test') {
  app.use(morgan(config.nodeEnv === 'production' ? 'combined' : 'dev'));
}

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ── Health check ───────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  const { getAdapter } = require('./db/DeltaDatabaseAdapter');
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    dbMode: getAdapter().mode,
  });
});

// ── API routes ─────────────────────────────────────────────────────────────

app.use('/api', apiRouter);

// ── 404 handler ────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// ── Global error handler ───────────────────────────────────────────────────

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  if (status >= 500) {
    console.error('[Error]', err);
  }

  res.status(status).json({
    error: message,
    ...(config.nodeEnv !== 'production' && status >= 500 ? { stack: err.stack } : {}),
  });
});

module.exports = app;
