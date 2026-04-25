import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../lib/api'
import type { User, AuthResponse } from '../types'

export const useAuthStore = defineStore('auth', () => {
  // Access token lives in Pinia memory only — NOT in localStorage.
  // This prevents XSS from easily exfiltrating the token.
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  function _setAuth(accessToken: string, u: User): void {
    token.value = accessToken
    user.value = u
    // Persist user metadata (not the token) so the UI can restore user info on reload
    localStorage.setItem('deltachat-user', JSON.stringify(u))
  }

  function _clearAuth(): void {
    token.value = null
    user.value = null
    localStorage.removeItem('deltachat-user')
  }

  /**
   * Called on every page load. Exchanges the HttpOnly refresh cookie for a
   * new access token without requiring the user to log in again.
   */
  async function refreshAccessToken(): Promise<boolean> {
    try {
      const { data } = await api.post<AuthResponse>('/auth/refresh')
      token.value = data.accessToken
      user.value = data.user
      localStorage.setItem('deltachat-user', JSON.stringify(data.user))
      return true
    } catch {
      _clearAuth()
      return false
    }
  }

  async function register(email: string, password: string, name: string): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/register', { email, password, name })
    _setAuth(data.accessToken, data.user)
    return data
  }

  async function login(email: string, password: string): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password })
    _setAuth(data.accessToken, data.user)
    return data
  }

  async function googleLogin(idToken: string): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/google', { idToken })
    _setAuth(data.accessToken, data.user)
    return data
  }

  async function fetchMe(): Promise<User | null> {
    try {
      const { data } = await api.get<User>('/auth/me')
      user.value = data
      localStorage.setItem('deltachat-user', JSON.stringify(data))
      return data
    } catch {
      logout()
      return null
    }
  }

  async function logout(): Promise<void> {
    try {
      await api.post('/auth/logout')
    } catch {
      // Ignore errors — always clear local state
    } finally {
      _clearAuth()
    }
  }

  /**
   * Restore user display info from localStorage on page load (before refreshAccessToken completes).
   * The token itself is never read from storage.
   */
  function loadFromStorage(): void {
    const savedUser = localStorage.getItem('deltachat-user')
    if (savedUser) {
      try {
        user.value = JSON.parse(savedUser)
      } catch {
        /* ignore malformed data */
      }
    }
  }

  return {
    user,
    token,
    isAuthenticated,
    isAdmin,
    loadFromStorage,
    refreshAccessToken,
    register,
    login,
    googleLogin,
    fetchMe,
    logout,
  }
})
