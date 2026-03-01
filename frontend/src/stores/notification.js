import { defineStore } from 'pinia'
import { ref } from 'vue'

/**
 * Global notification/snackbar store.
 * Usage:
 *   const notify = useNotificationStore()
 *   notify.success('Settings saved!')
 *   notify.error('Failed to save settings')
 *   notify.info('Loading...')
 */
export const useNotificationStore = defineStore('notification', () => {
  const show = ref(false)
  const message = ref('')
  const color = ref('success')
  const timeout = ref(4000)

  function success(msg, ms = 4000) {
    message.value = msg
    color.value = 'success'
    timeout.value = ms
    show.value = true
  }

  function error(msg, ms = 6000) {
    message.value = msg
    color.value = 'error'
    timeout.value = ms
    show.value = true
  }

  function info(msg, ms = 4000) {
    message.value = msg
    color.value = 'info'
    timeout.value = ms
    show.value = true
  }

  function warning(msg, ms = 5000) {
    message.value = msg
    color.value = 'warning'
    timeout.value = ms
    show.value = true
  }

  return { show, message, color, timeout, success, error, info, warning }
})
