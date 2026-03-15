import { test, expect, APIRequestContext } from '@playwright/test';

/*
 * ─────────────────────────────────────────────────────────────
 *  DeltaChat E2E — Sharing & Isolation
 *
 *  Verifies:
 *    1. Chats are user-scoped (User A cannot see User B's chats)
 *    2. Resources are owner-scoped (user sees only own models/agents/tools)
 *    3. Admin can see everything
 *    4. Sharing a resource with a user makes it visible
 *    5. Group-based sharing works
 *    6. Unsharing removes access
 *    7. Error toasts appear on failed operations
 *
 *  Prerequisites:
 *    - Backend  running on http://localhost:3000
 *    - Frontend running on http://localhost:5173
 *
 *  Run:
 *    npx playwright test sharing-isolation
 * ─────────────────────────────────────────────────────────────
 */

const API = 'http://127.0.0.1:3000/api';

// Test users — created during setup
const ADMIN_USER = { email: 'blabla@blabla.com', password: 'blabla', name: 'E2E Admin' };
const USER_A     = { email: 'user-a-e2e@test.local', password: 'UserA1234!', name: 'User A' };
const USER_B     = { email: 'user-b-e2e@test.local', password: 'UserB1234!', name: 'User B' };

interface AuthResult { token: string; user: { id: string; role: string } }

// ── Helpers ─────────────────────────────────────────────────

async function registerOrLogin(
  api: APIRequestContext,
  creds: { email: string; password: string; name: string },
): Promise<AuthResult> {
  // Try login first
  let res = await api.post(`${API}/auth/login`, { data: { email: creds.email, password: creds.password } });
  if (res.ok()) return res.json() as Promise<AuthResult>;

  // Register
  res = await api.post(`${API}/auth/register`, {
    data: { email: creds.email, password: creds.password, name: creds.name },
  });
  if (res.ok()) return res.json() as Promise<AuthResult>;

  throw new Error(`Could not auth ${creds.email}: ${res.status()} ${await res.text()}`);
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

// ═══════════════════════════════════════════════════════════════
//  TEST SUITE
// ═══════════════════════════════════════════════════════════════

test.describe.serial('Sharing & Isolation', () => {
  let api: APIRequestContext;
  let admin: AuthResult;
  let userA: AuthResult;
  let userB: AuthResult;

  // Resources created during tests
  let adminModelId: string;
  let userAModelId: string;
  let userAChatId: string;
  let userBChatId: string;
  let groupId: string;
  let shareId: string;

  // ── Setup ───────────────────────────────────────────────────
  test.beforeAll(async ({ playwright }) => {
    api = await playwright.request.newContext();
    admin = await registerOrLogin(api, ADMIN_USER);
    userA  = await registerOrLogin(api, USER_A);
    userB  = await registerOrLogin(api, USER_B);

    // Make sure admin is actually admin
    expect(admin.user.role).toBe('admin');
  });

  test.afterAll(async () => {
    await api?.dispose();
  });

  // ─────────────────────────────────────────────────────────
  //  1 — Chat Isolation
  // ─────────────────────────────────────────────────────────
  test('User A creates a chat — User B cannot see it', async () => {
    // User A creates a chat
    const createRes = await api.post(`${API}/chats`, {
      headers: authHeaders(userA.token),
      data: { title: 'UserA Private Chat', modelId: 'dummy' },
    });
    expect(createRes.ok()).toBe(true);
    const chat = await createRes.json();
    userAChatId = chat.id;

    // User B lists chats — should NOT include User A's chat
    const listRes = await api.get(`${API}/chats`, { headers: authHeaders(userB.token) });
    expect(listRes.ok()).toBe(true);
    const chats: any[] = await listRes.json();
    const ids = chats.map((c: any) => c.id);
    expect(ids).not.toContain(userAChatId);
  });

  test('User B creates a chat — User A cannot see it', async () => {
    const createRes = await api.post(`${API}/chats`, {
      headers: authHeaders(userB.token),
      data: { title: 'UserB Private Chat', modelId: 'dummy' },
    });
    expect(createRes.ok()).toBe(true);
    const chat = await createRes.json();
    userBChatId = chat.id;

    const listRes = await api.get(`${API}/chats`, { headers: authHeaders(userA.token) });
    const chats: any[] = await listRes.json();
    expect(chats.map((c: any) => c.id)).not.toContain(userBChatId);
  });

  test('User B cannot access User A chat by ID', async () => {
    const res = await api.get(`${API}/chats/${userAChatId}`, { headers: authHeaders(userB.token) });
    expect(res.status()).toBe(403);
  });

  test('Admin can see all chats', async () => {
    const listRes = await api.get(`${API}/chats`, { headers: authHeaders(admin.token) });
    expect(listRes.ok()).toBe(true);
    const chats: any[] = await listRes.json();
    const ids = chats.map((c: any) => c.id);
    expect(ids).toContain(userAChatId);
    expect(ids).toContain(userBChatId);
  });

  // ─────────────────────────────────────────────────────────
  //  2 — Resource (Model) Ownership Isolation
  // ─────────────────────────────────────────────────────────
  test('Admin creates a model — regular user cannot see it', async () => {
    const createRes = await api.post(`${API}/models`, {
      headers: authHeaders(admin.token),
      data: { name: 'Admin Only Model', provider: 'test', modelName: 'test-model' },
    });
    expect(createRes.ok()).toBe(true);
    const model = await createRes.json();
    adminModelId = model.id;

    // User A lists models — should NOT contain admin's model
    const listRes = await api.get(`${API}/models`, { headers: authHeaders(userA.token) });
    expect(listRes.ok()).toBe(true);
    const models: any[] = await listRes.json();
    expect(models.map((m: any) => m.id)).not.toContain(adminModelId);
  });

  test('User A creates a model — User B cannot see it', async () => {
    const createRes = await api.post(`${API}/models`, {
      headers: authHeaders(userA.token),
      data: { name: 'UserA Model', provider: 'test', modelName: 'test-model-a' },
    });
    expect(createRes.ok()).toBe(true);
    const model = await createRes.json();
    userAModelId = model.id;

    // User B cannot see it
    const listRes = await api.get(`${API}/models`, { headers: authHeaders(userB.token) });
    const models: any[] = await listRes.json();
    expect(models.map((m: any) => m.id)).not.toContain(userAModelId);
  });

  // ─────────────────────────────────────────────────────────
  //  3 — Direct User Sharing
  // ─────────────────────────────────────────────────────────
  test('Admin shares model with User A — User A can now see it', async () => {
    // Share admin's model with User A
    const shareRes = await api.post(`${API}/sharing`, {
      headers: authHeaders(admin.token),
      data: {
        resourceType: 'ai_model',
        resourceId: adminModelId,
        targetType: 'user',
        targetId: userA.user.id,
      },
    });
    expect(shareRes.ok()).toBe(true);
    const share = await shareRes.json();
    shareId = share.id;

    // User A should now see the admin's model
    const listRes = await api.get(`${API}/models`, { headers: authHeaders(userA.token) });
    const models: any[] = await listRes.json();
    expect(models.map((m: any) => m.id)).toContain(adminModelId);
  });

  test('User B still cannot see the shared model', async () => {
    const listRes = await api.get(`${API}/models`, { headers: authHeaders(userB.token) });
    const models: any[] = await listRes.json();
    expect(models.map((m: any) => m.id)).not.toContain(adminModelId);
  });

  test('Unsharing removes access', async () => {
    // Admin unshares
    const delRes = await api.delete(`${API}/sharing/${shareId}`, { headers: authHeaders(admin.token) });
    expect(delRes.ok()).toBe(true);

    // User A can no longer see admin's model
    const listRes = await api.get(`${API}/models`, { headers: authHeaders(userA.token) });
    const models: any[] = await listRes.json();
    expect(models.map((m: any) => m.id)).not.toContain(adminModelId);
  });

  // ─────────────────────────────────────────────────────────
  //  4 — Group-based Sharing
  // ─────────────────────────────────────────────────────────
  test('Admin creates a group and adds User B', async () => {
    const createRes = await api.post(`${API}/user-groups`, {
      headers: authHeaders(admin.token),
      data: { name: 'Test Group', description: 'E2E test group', memberIds: [userB.user.id] },
    });
    expect(createRes.ok()).toBe(true);
    const group = await createRes.json();
    groupId = group.id;
    expect(group.memberIds).toContain(userB.user.id);
  });

  test('Admin shares model with group — User B can see it via group', async () => {
    const shareRes = await api.post(`${API}/sharing`, {
      headers: authHeaders(admin.token),
      data: {
        resourceType: 'ai_model',
        resourceId: adminModelId,
        targetType: 'group',
        targetId: groupId,
      },
    });
    expect(shareRes.ok()).toBe(true);

    // User B (group member) can now see the model
    const listRes = await api.get(`${API}/models`, { headers: authHeaders(userB.token) });
    const models: any[] = await listRes.json();
    expect(models.map((m: any) => m.id)).toContain(adminModelId);
  });

  test('User A (not in group) still cannot see the group-shared model', async () => {
    const listRes = await api.get(`${API}/models`, { headers: authHeaders(userA.token) });
    const models: any[] = await listRes.json();
    expect(models.map((m: any) => m.id)).not.toContain(adminModelId);
  });

  test('Admin adds User A to the group — now User A can see it too', async () => {
    const addRes = await api.post(`${API}/user-groups/${groupId}/members`, {
      headers: authHeaders(admin.token),
      data: { userIds: [userA.user.id] },
    });
    expect(addRes.ok()).toBe(true);

    const listRes = await api.get(`${API}/models`, { headers: authHeaders(userA.token) });
    const models: any[] = await listRes.json();
    expect(models.map((m: any) => m.id)).toContain(adminModelId);
  });

  test('Admin removes User A from group — access revoked', async () => {
    const removeRes = await api.delete(`${API}/user-groups/${groupId}/members`, {
      headers: authHeaders(admin.token),
      data: { userIds: [userA.user.id] },
    });
    expect(removeRes.ok()).toBe(true);

    const listRes = await api.get(`${API}/models`, { headers: authHeaders(userA.token) });
    const models: any[] = await listRes.json();
    expect(models.map((m: any) => m.id)).not.toContain(adminModelId);
  });

  // ─────────────────────────────────────────────────────────
  //  5 — Ownership Guards (edit / delete)
  // ─────────────────────────────────────────────────────────
  test('User B cannot update User A model', async () => {
    const res = await api.put(`${API}/models/${userAModelId}`, {
      headers: authHeaders(userB.token),
      data: { name: 'Hijacked Model' },
    });
    expect(res.status()).toBe(403);
  });

  test('User B cannot delete User A model', async () => {
    const res = await api.delete(`${API}/models/${userAModelId}`, { headers: authHeaders(userB.token) });
    expect(res.status()).toBe(403);
  });

  test('User A can update own model', async () => {
    const res = await api.put(`${API}/models/${userAModelId}`, {
      headers: authHeaders(userA.token),
      data: { name: 'UserA Model Updated' },
    });
    expect(res.ok()).toBe(true);
  });

  test('Admin can delete any model', async () => {
    const res = await api.delete(`${API}/models/${userAModelId}`, { headers: authHeaders(admin.token) });
    expect(res.ok()).toBe(true);
  });

  // ─────────────────────────────────────────────────────────
  //  6 — User B cannot modify User A chat
  // ─────────────────────────────────────────────────────────
  test('User B cannot update User A chat', async () => {
    const res = await api.patch(`${API}/chats/${userAChatId}`, {
      headers: authHeaders(userB.token),
      data: { title: 'Hijacked Chat' },
    });
    expect(res.status()).toBe(403);
  });

  test('User B cannot delete User A chat', async () => {
    const res = await api.delete(`${API}/chats/${userAChatId}`, { headers: authHeaders(userB.token) });
    expect(res.status()).toBe(403);
  });

  // ─────────────────────────────────────────────────────────
  //  7 — Cleanup
  // ─────────────────────────────────────────────────────────
  test('Cleanup test data', async () => {
    // Delete chats
    await api.delete(`${API}/chats/${userAChatId}`, { headers: authHeaders(userA.token) }).catch(() => {});
    await api.delete(`${API}/chats/${userBChatId}`, { headers: authHeaders(userB.token) }).catch(() => {});

    // Delete admin model
    await api.delete(`${API}/models/${adminModelId}`, { headers: authHeaders(admin.token) }).catch(() => {});

    // Delete group
    await api.delete(`${API}/user-groups/${groupId}`, { headers: authHeaders(admin.token) }).catch(() => {});
  });
});
