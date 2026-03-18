'use strict'

/**
 * SCIM 2.0 (RFC 7644) endpoints for external identity provider integration.
 * Supports Groups resource type for provisioning user groups from Keycloak, Azure AD, Okta, etc.
 * Auth: Bearer token using SCIM_API_TOKEN env var (service-to-service).
 */

import { Router, Request, Response, NextFunction } from 'express'
import { randomUUID } from 'crypto'
import config from '../config'
import { getAdapter } from '../db/DeltaDatabaseAdapter'

const router = Router()

// SCIM auth middleware — uses a separate static token for service-to-service auth
function scimAuth(req: Request, res: Response, next: NextFunction): void {
  if (!config.scim.apiToken) {
    res.status(501).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'SCIM provisioning is not configured (SCIM_API_TOKEN not set)',
      status: '501',
    })
    return
  }
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ') || header.slice(7) !== config.scim.apiToken) {
    res.status(401).json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
      detail: 'Invalid SCIM bearer token',
      status: '401',
    })
    return
  }
  next()
}

router.use(scimAuth)

// ── SCIM Groups ─────────────────────────────────────────────────────────────

// GET /scim/v2/Groups
router.get('/Groups', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    const groups = await db.listUserGroups()
    const resources = groups.map(toScimGroup)
    res.json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: resources.length,
      Resources: resources,
    })
  } catch (err) {
    next(err)
  }
})

// POST /scim/v2/Groups
router.post('/Groups', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scim = req.body as Record<string, unknown>
    const db = getAdapter()

    const memberIds = await resolveScimMembers(scim['members'] as any[] | undefined)

    const group = await db.createUserGroup({
      id: randomUUID(),
      name: (scim['displayName'] as string) || 'SCIM Group',
      description: null,
      memberIds,
      externalId: (scim['externalId'] as string) || null,
      metadata: { scimManaged: true },
    })

    res.status(201).json(toScimGroup(group))
  } catch (err) {
    next(err)
  }
})

// GET /scim/v2/Groups/:id
router.get('/Groups/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    const group = await db.getUserGroup(req.params.id as string)
    if (!group) {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'Group not found',
        status: '404',
      })
    }
    res.json(toScimGroup(group))
  } catch (err) {
    next(err)
  }
})

// PUT /scim/v2/Groups/:id — full replace
router.put('/Groups/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scim = req.body as Record<string, unknown>
    const db = getAdapter()

    const memberIds = await resolveScimMembers(scim['members'] as any[] | undefined)

    const group = await db.updateUserGroup(req.params.id as string, {
      name: scim['displayName'] as string,
      memberIds,
      externalId: (scim['externalId'] as string) || null,
    })
    if (!group) {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'Group not found',
        status: '404',
      })
    }
    res.json(toScimGroup(group))
  } catch (err) {
    next(err)
  }
})

// PATCH /scim/v2/Groups/:id — modify members (RFC 7644 §3.5.2)
router.patch('/Groups/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const scim = req.body as Record<string, unknown>
    const db = getAdapter()
    const group = await db.getUserGroup(req.params.id as string)
    if (!group) {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'Group not found',
        status: '404',
      })
    }

    let memberIds = [...((group['memberIds'] as string[]) || [])]
    const operations = (scim['Operations'] as any[]) || []

    for (const op of operations) {
      const opType = ((op['op'] as string) || '').toLowerCase()
      if (op['path'] === 'members' || !op['path']) {
        const values = (op['value'] as any[]) || []
        const ids = values
          .map((v: any) => v['value'] || v['$ref']?.split('/').pop() || v)
          .filter(Boolean)

        if (opType === 'add') {
          memberIds = [...new Set([...memberIds, ...ids])]
        } else if (opType === 'remove') {
          memberIds = memberIds.filter((id) => !ids.includes(id))
        } else if (opType === 'replace') {
          memberIds = ids
        }
      }
      if (opType === 'replace' && op['path'] === 'displayName') {
        await db.updateUserGroup(req.params.id as string, { name: op['value'] as string })
      }
    }

    const updated = await db.updateUserGroup(req.params.id as string, { memberIds })
    res.json(toScimGroup(updated!))
  } catch (err) {
    next(err)
  }
})

// DELETE /scim/v2/Groups/:id
router.delete('/Groups/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    await db.deleteResourceSharesByTarget('group', req.params.id as string)
    await db.deleteUserGroup(req.params.id as string)
    res.status(204).send()
  } catch (err) {
    next(err)
  }
})

// ── SCIM Users (read-only) ─────────────────────────────────────────────────

// GET /scim/v2/Users
router.get('/Users', async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    const users = await db.listUsers()
    const resources = users.map(toScimUser)
    res.json({
      schemas: ['urn:ietf:params:scim:api:messages:2.0:ListResponse'],
      totalResults: resources.length,
      Resources: resources,
    })
  } catch (err) {
    next(err)
  }
})

// GET /scim/v2/Users/:id
router.get('/Users/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const db = getAdapter()
    const user = await db.getUserById(req.params.id as string)
    if (!user) {
      return res.status(404).json({
        schemas: ['urn:ietf:params:scim:api:messages:2.0:Error'],
        detail: 'User not found',
        status: '404',
      })
    }
    res.json(toScimUser(user))
  } catch (err) {
    next(err)
  }
})

// ── Helpers ─────────────────────────────────────────────────────────────────

function toScimGroup(group: Record<string, unknown>) {
  const memberIds = (group['memberIds'] as string[]) || []
  return {
    schemas: ['urn:ietf:params:scim:core:2.0:Group'],
    id: group['id'],
    displayName: group['name'],
    externalId: group['externalId'] || undefined,
    members: memberIds.map((id) => ({ value: id, $ref: `../Users/${id}` })),
    meta: {
      resourceType: 'Group',
      created: group['createdAt'],
      lastModified: group['updatedAt'],
    },
  }
}

function toScimUser(user: Record<string, unknown>) {
  return {
    schemas: ['urn:ietf:params:scim:core:2.0:User'],
    id: user['id'],
    userName: user['email'],
    name: { formatted: user['name'] },
    emails: [{ value: user['email'], primary: true }],
    active: !user['disabled'],
    meta: {
      resourceType: 'User',
      created: user['createdAt'],
      lastModified: user['updatedAt'],
    },
  }
}

async function resolveScimMembers(members: any[] | undefined): Promise<string[]> {
  if (!members || !Array.isArray(members)) return []
  return members.map((m) => m['value'] || '').filter(Boolean)
}

export default router
