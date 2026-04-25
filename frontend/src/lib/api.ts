import axios from 'axios'
import { useAuthStore } from '../stores/auth'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
  withCredentials: true, // Required so the browser sends the HttpOnly refresh cookie
})

// Attach JWT access token from Pinia store — not from localStorage
api.interceptors.request.use((config) => {
  try {
    const auth = useAuthStore()
    if (auth.token) {
      config.headers.Authorization = `Bearer ${auth.token}`
    }
  } catch {
    /* store not ready yet during bootstrap */
  }
  return config
})

// On 401, attempt one silent token refresh then retry the original request.
// If refresh fails, call logout and redirect to /login.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    // Skip refresh loop for auth requests themselves
    const isAuthEndpoint = error.config?.url?.includes('/auth/')
    if (error.response?.status === 401 && !error.config?._retry && !isAuthEndpoint) {
      error.config._retry = true
      try {
        const { useAuthStore } = await import('../stores/auth')
        const auth = useAuthStore()
        const ok = await auth.refreshAccessToken()
        if (ok) {
          error.config.headers['Authorization'] = `Bearer ${auth.token}`
          return api(error.config)
        }
      } catch {
        /* refresh failed */
      }
      // Refresh failed → clear auth and redirect
      try {
        const { useAuthStore } = await import('../stores/auth')
        await useAuthStore().logout()
      } catch {
        /* ignore */
      }
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    // Network errors — show a user-visible notification
    if (!error.response && error.message) {
      import('../stores/notification')
        .then(({ useNotificationStore }) => {
          try {
            const notify = useNotificationStore()
            notify.error(
              error.code === 'ERR_NETWORK'
                ? 'Network error — cannot reach the server'
                : error.message,
            )
          } catch {
            /* store not ready yet */
          }
        })
        .catch(() => {})
    }
    return Promise.reject(error)
  },
)

export default api
