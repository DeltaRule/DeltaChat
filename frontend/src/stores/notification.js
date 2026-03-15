import { defineStore } from 'pinia'
import { toast } from 'vue-sonner'

/**
 * Global notification store using vue-sonner.
 * Usage:
 *   const notify = useNotificationStore()
 *   notify.success('Settings saved!')
 *   notify.error('Failed to save settings')
 */
export const useNotificationStore = defineStore('notification', () => {

  function success(msg, ms = 4000) {
    toast.success(msg, { duration: ms })
  }

  function error(msg, ms = 6000) {
    toast.error(msg, { duration: ms })
  }

  function info(msg, ms = 4000) {
    toast.info(msg, { duration: ms })
  }

  function warning(msg, ms = 5000) {
    toast.warning(msg, { duration: ms })
  }

  return { success, error, info, warning }
})
