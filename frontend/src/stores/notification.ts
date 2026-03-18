import { defineStore } from 'pinia'
import { toast } from 'vue-sonner'

export const useNotificationStore = defineStore('notification', () => {
  function success(msg: string, ms = 4000): void {
    toast.success(msg, { duration: ms })
  }

  function error(msg: string, ms = 6000): void {
    toast.error(msg, { duration: ms })
  }

  function info(msg: string, ms = 4000): void {
    toast.info(msg, { duration: ms })
  }

  function warning(msg: string, ms = 5000): void {
    toast.warning(msg, { duration: ms })
  }

  return { success, error, info, warning }
})
