import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '../lib/api'

export const useAuthStore = defineStore('auth', () => {
  const user = ref(null)
  const token = ref(null)

  const isAuthenticated = computed(() => !!token.value)
  const isAdmin = computed(() => user.value?.role === 'admin')

  function loadFromStorage() {
    const savedToken = localStorage.getItem('deltachat-token')
    const savedUser = localStorage.getItem('deltachat-user')
    if (savedToken && savedUser) {
      token.value = savedToken
      try { user.value = JSON.parse(savedUser) } catch { /* ignore */ }
    }
  }

  function _persist(t, u) {
    token.value = t
    user.value = u
    localStorage.setItem('deltachat-token', t)
    localStorage.setItem('deltachat-user', JSON.stringify(u))
  }

  async function register(email, password, name) {
    const { data } = await api.post('/auth/register', { email, password, name })
    _persist(data.token, data.user)
    return data
  }

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password })
    _persist(data.token, data.user)
    return data
  }

  async function googleLogin(idToken) {
    const { data } = await api.post('/auth/google', { idToken })
    _persist(data.token, data.user)
    return data
  }

  async function fetchMe() {
    try {
      const { data } = await api.get('/auth/me')
      user.value = data
      localStorage.setItem('deltachat-user', JSON.stringify(data))
      return data
    } catch {
      logout()
      return null
    }
  }

  function logout() {
    token.value = null
    user.value = null
    localStorage.removeItem('deltachat-token')
    localStorage.removeItem('deltachat-user')
  }

  return {
    user, token,
    isAuthenticated, isAdmin,
    loadFromStorage, register, login, googleLogin, fetchMe, logout
  }
})
