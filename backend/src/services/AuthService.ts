'use strict'

import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import { randomBytes } from 'crypto'
import config from '../config'
import { getAdapter, Entity } from '../db/DeltaDatabaseAdapter'
import logger from '../logger'

export interface JwtPayload {
  id: string
  email: string
  name: string
  role: 'admin' | 'user'
}

const SALT_ROUNDS = 12

// Duration of refresh token: 7 days in milliseconds
const REFRESH_TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000

export class AuthService {
  /**
   * Issue a short-lived access token (JWT) + a long-lived refresh token (opaque).
   * The refresh token is stored in the DB. The caller must set it as an HttpOnly cookie.
   */
  async _issueTokenPair(user: Entity): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = this.generateToken(user)
    const db = getAdapter()
    const id = randomBytes(64).toString('hex')
    await db.createRefreshToken({
      id,
      userId: user.id,
      expiresAt: Date.now() + REFRESH_TOKEN_TTL_MS,
      revokedAt: null,
    })
    return { accessToken, refreshToken: id }
  }

  /**
   * Validate a refresh token from the DB. Returns the user if valid, throws otherwise.
   */
  async validateAndRotateRefreshToken(
    incomingToken: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: Entity }> {
    const db = getAdapter()
    const record = await db.getRefreshToken(incomingToken)
    if (!record) {
      const err: any = new Error('Invalid refresh token')
      err.status = 401
      throw err
    }
    if (record['revokedAt']) {
      const err: any = new Error('Refresh token has been revoked')
      err.status = 401
      throw err
    }
    if ((record['expiresAt'] as number) < Date.now()) {
      await db.updateRefreshToken(incomingToken, { revokedAt: Date.now() })
      const err: any = new Error('Refresh token has expired')
      err.status = 401
      throw err
    }

    const user = await db.getUserById(record['userId'] as string)
    if (!user || user['disabled']) {
      const err: any = new Error('User not found or disabled')
      err.status = 401
      throw err
    }

    // Rotate: revoke old token, issue new pair
    await db.updateRefreshToken(incomingToken, { revokedAt: Date.now() })
    const { accessToken, refreshToken } = await this._issueTokenPair(user)
    return { accessToken, refreshToken, user }
  }

  /**
   * Revoke a specific refresh token (on logout).
   */
  async revokeRefreshToken(token: string): Promise<void> {
    const db = getAdapter()
    await db.updateRefreshToken(token, { revokedAt: Date.now() })
  }

  /** Register a new user with email + password. First user automatically becomes admin. */
  async register(
    email: string,
    password: string,
    name: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: Entity }> {
    const db = getAdapter()
    const existing = await db.getUserByEmail(email)
    if (existing) {
      const err: any = new Error('A user with this email already exists')
      err.status = 409
      throw err
    }

    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS)

    // First user becomes admin; also check ADMIN_EMAIL env var
    const allUsers = await db.listUsers()
    const isFirst = allUsers.length === 0
    const isDesignatedAdmin =
      config.adminEmail && email.toLowerCase() === config.adminEmail.toLowerCase()
    const role = isFirst || isDesignatedAdmin ? 'admin' : 'user'

    const user = await db.createUser({
      email: email.toLowerCase().trim(),
      name: name.trim(),
      role,
      passwordHash,
      googleId: null,
      picture: null,
      disabled: false,
    })

    logger.info(`[Auth] User registered: ${email} (role: ${role})`)
    const { accessToken, refreshToken } = await this._issueTokenPair(user)
    return { accessToken, refreshToken, user: this._sanitizeUser(user) }
  }

  /** Authenticate with email + password. */
  async login(
    email: string,
    password: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: Entity }> {
    const db = getAdapter()
    const user = await db.getUserByEmail(email)
    if (!user) {
      const err: any = new Error('Invalid email or password')
      err.status = 401
      throw err
    }
    if (user['disabled']) {
      const err: any = new Error('Account is disabled')
      err.status = 403
      throw err
    }

    const hash = user['passwordHash'] as string | null
    if (!hash) {
      const err: any = new Error('This account uses Google sign-in. Please sign in with Google.')
      err.status = 401
      throw err
    }

    const valid = await bcrypt.compare(password, hash)
    if (!valid) {
      const err: any = new Error('Invalid email or password')
      err.status = 401
      throw err
    }

    logger.info(`[Auth] User logged in: ${email}`)
    const { accessToken, refreshToken } = await this._issueTokenPair(user)
    return { accessToken, refreshToken, user: this._sanitizeUser(user) }
  }

  /** Authenticate / register via Google ID token. */
  async googleAuth(
    idToken: string,
  ): Promise<{ accessToken: string; refreshToken: string; user: Entity }> {
    if (!config.google.clientId) {
      const err: any = new Error('Google authentication is not configured')
      err.status = 501
      throw err
    }

    const { OAuth2Client } = await import('google-auth-library')
    const client = new OAuth2Client(config.google.clientId)

    let payload: any
    try {
      const ticket = await client.verifyIdToken({
        idToken,
        audience: config.google.clientId,
      })
      payload = ticket.getPayload()
    } catch {
      const err: any = new Error('Invalid Google token')
      err.status = 401
      throw err
    }

    if (!payload?.email) {
      const err: any = new Error('Google token missing email')
      err.status = 401
      throw err
    }

    const db = getAdapter()
    let user = await db.getUserByGoogleId(payload.sub)

    if (!user) {
      // Check if a user with this email exists (registered via email/pass)
      user = await db.getUserByEmail(payload.email)
      if (user) {
        // Link Google account
        await db.updateUser(user.id, { googleId: payload.sub, picture: payload.picture || null })
        user = (await db.getUserById(user.id))!
      } else {
        // Create new user
        const allUsers = await db.listUsers()
        const isFirst = allUsers.length === 0
        const isDesignatedAdmin =
          config.adminEmail && payload.email.toLowerCase() === config.adminEmail.toLowerCase()
        const role = isFirst || isDesignatedAdmin ? 'admin' : 'user'

        user = await db.createUser({
          email: payload.email.toLowerCase(),
          name: payload.name || payload.email.split('@')[0],
          role,
          passwordHash: null,
          googleId: payload.sub,
          picture: payload.picture || null,
          disabled: false,
        })
        logger.info(`[Auth] Google user registered: ${payload.email} (role: ${role})`)
      }
    }

    if (user['disabled']) {
      const err: any = new Error('Account is disabled')
      err.status = 403
      throw err
    }

    logger.info(`[Auth] Google login: ${user['email']}`)
    const { accessToken, refreshToken } = await this._issueTokenPair(user)
    return { accessToken, refreshToken, user: this._sanitizeUser(user) }
  }

  /** Verify and decode a JWT token. */
  verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, config.jwt.secret) as JwtPayload
    } catch {
      const err: any = new Error('Invalid or expired token')
      err.status = 401
      throw err
    }
  }

  /** Generate a JWT for a user entity. */
  generateToken(user: Entity): string {
    const payload: JwtPayload = {
      id: user.id,
      email: user['email'] as string,
      name: user['name'] as string,
      role: user['role'] as 'admin' | 'user',
    }
    return jwt.sign(payload, config.jwt.secret, {
      expiresIn: config.jwt.expiresIn as string,
    } as jwt.SignOptions)
  }

  /** Strip sensitive fields from user entity before returning to client. */
  _sanitizeUser(user: Entity): Entity {
    const { passwordHash, ...safe } = user as Record<string, unknown>
    return safe as Entity
  }
}

let _instance: AuthService | null = null
export function getAuthService(): AuthService {
  if (!_instance) _instance = new AuthService()
  return _instance
}
