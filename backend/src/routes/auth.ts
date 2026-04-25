'use strict'

import { Router, Request, Response, NextFunction } from 'express'
import { getAuthService } from '../services/AuthService'
import { requireAuth } from '../middleware/auth'

const router = Router()

/** Milliseconds the refresh cookie stays valid (matches the DB TTL). */
const REFRESH_COOKIE_MAX_AGE = 7 * 24 * 60 * 60 * 1000

function setRefreshCookie(res: Response, token: string): void {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env['NODE_ENV'] === 'production',
    sameSite: 'strict',
    maxAge: REFRESH_COOKIE_MAX_AGE,
    path: '/api/auth',
  })
}

function clearRefreshCookie(res: Response): void {
  res.clearCookie('refreshToken', { path: '/api/auth' })
}

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password, name } = req.body as Record<string, string>
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'email, password, and name are required' })
    }
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' })
    }
    const authService = getAuthService()
    const result = await authService.register(email, password, name)
    setRefreshCookie(res, result.refreshToken)
    res.status(201).json({ accessToken: result.accessToken, user: result.user })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body as Record<string, string>
    if (!email || !password) {
      return res.status(400).json({ error: 'email and password are required' })
    }
    const authService = getAuthService()
    const result = await authService.login(email, password)
    setRefreshCookie(res, result.refreshToken)
    res.json({ accessToken: result.accessToken, user: result.user })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/google
router.post('/google', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { idToken } = req.body as Record<string, string>
    if (!idToken) {
      return res.status(400).json({ error: 'idToken is required' })
    }
    const authService = getAuthService()
    const result = await authService.googleAuth(idToken)
    setRefreshCookie(res, result.refreshToken)
    res.json({ accessToken: result.accessToken, user: result.user })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/refresh — reads the HttpOnly cookie, issues a new access token
router.post('/refresh', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const incomingToken = req.cookies?.['refreshToken'] as string | undefined
    if (!incomingToken) {
      return res.status(401).json({ error: 'No refresh token provided' })
    }
    const authService = getAuthService()
    const result = await authService.validateAndRotateRefreshToken(incomingToken)
    setRefreshCookie(res, result.refreshToken)
    res.json({ accessToken: result.accessToken, user: authService._sanitizeUser(result.user) })
  } catch (err) {
    next(err)
  }
})

// POST /api/auth/logout — revoke the refresh token and clear the cookie
router.post('/logout', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const incomingToken = req.cookies?.['refreshToken'] as string | undefined
    if (incomingToken) {
      const authService = getAuthService()
      await authService.revokeRefreshToken(incomingToken)
    }
    clearRefreshCookie(res)
    res.json({ ok: true })
  } catch (err) {
    next(err)
  }
})

// GET /api/auth/google-enabled — public, checks if Google auth is configured
router.get('/google-enabled', (_req: Request, res: Response) => {
  const config = require('../config').default
  res.json({
    enabled: Boolean(config.google.clientId),
    clientId: config.google.clientId || null,
  })
})

// GET /api/auth/me — requires auth
router.get('/me', requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { getAdapter } = await import('../db/DeltaDatabaseAdapter')
    const db = getAdapter()
    const user = await db.getUserById(req.user!.id)
    if (!user) return res.status(404).json({ error: 'User not found' })
    const authService = getAuthService()
    res.json(authService._sanitizeUser(user))
  } catch (err) {
    next(err)
  }
})

export default router
