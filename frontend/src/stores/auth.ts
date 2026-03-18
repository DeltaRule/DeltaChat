import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../lib/api'
import type { User, AuthResponse } from '../types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  function loadFromStorage(): void {
    const savedToken = localStorage.getItem('deltachat-token')
    const savedUser = localStorage.getItem('deltachat-user')
    if (savedToken && savedUser) {
      token.value = savedToken
      try {
        user.value = JSON.parse(savedUser)
      } catch {
        /* ignore */
      }
    }
  }

  function _persist(t: string, u: User): void {
    token.value = t
    user.value = u
    localStorage.setItem('deltachat-token', t)
    localStorage.setItem('deltachat-user', JSON.stringify(u))
  }

  async function register(email: string, password: string, name: string): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/register', { email, password, name })
    _persist(data.token, data.user)
    return data
  }

  async function login(email: string, password: string): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/login', { email, password })
    _persist(data.token, data.user)
    return data
  }

  async function googleLogin(idToken: string): Promise<AuthResponse> {
    const { data } = await api.post<AuthResponse>('/auth/google', { idToken })
    _persist(data.token, data.user)
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

  function logout(): void {
    token.value = null
    user.value = null
    localStorage.removeItem('deltachat-token')
    localStorage.removeItem('deltachat-user')
  }

  return {
    user,
    token,
    isAuthenticated,
    isAdmin,
    loadFromStorage,
    register,
    login,
    googleLogin,
    fetchMe,
    logout,
  }
})
