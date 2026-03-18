/**
 * Shared test setup for Pinia-based store tests.
 * Provides a mock API and notification tracking.
 */
import { vi } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'

// ── Mock axios-based API ─────────────────────────────────────────────────
export const mockApi = {
  get: vi.fn(),
  post: vi.fn(),
  put: vi.fn(),
  delete: vi.fn(),
  patch: vi.fn(),
}

vi.mock('../../lib/api', () => ({ default: mockApi }))

// ── Mock notification store (track calls) ────────────────────────────────
export const mockNotify = {
  success: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  warning: vi.fn(),
}

vi.mock('../notification', () => ({
  useNotificationStore: () => mockNotify,
}))

// ── Mock vue-sonner (toast) so it doesn't error in test env ──────────────
vi.mock('vue-sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn(), info: vi.fn(), warning: vi.fn() },
}))

/** Call in beforeEach to reset all mocks and create a fresh Pinia instance. */
export function setupStoreTest() {
  vi.clearAllMocks()
  setActivePinia(createPinia())
}
