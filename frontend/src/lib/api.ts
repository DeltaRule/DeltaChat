import axios from 'axios'

export const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000'

const api = axios.create({
  baseURL: `${API_URL}/api`,
  timeout: 30000,
})

// Attach JWT token to all requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('deltachat-token')
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

// On 401, clear auth and redirect to login; show network errors as notifications
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && !error.config?.url?.includes('/auth/')) {
      localStorage.removeItem('deltachat-token')
      localStorage.removeItem('deltachat-user')
      if (window.location.pathname !== '/login') {
        window.location.href = '/login'
      }
    }
    // Network errors (no response) — show a user-visible notification
    if (!error.response && error.message) {
      // Lazy-import to avoid circular dependency during app bootstrap
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
