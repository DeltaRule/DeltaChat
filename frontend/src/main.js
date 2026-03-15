import { createApp } from 'vue'
import { createPinia } from 'pinia'
import './styles/global.css'
import router from './router'
import App from './App.vue'

const pinia = createPinia()
const app = createApp(App)
app.use(pinia)
app.use(router)

// Restore auth session from localStorage before mounting
import { useAuthStore } from './stores/auth'
const authStore = useAuthStore()
authStore.loadFromStorage()

app.mount('#app')
