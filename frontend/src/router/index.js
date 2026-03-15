import { createRouter, createWebHistory } from 'vue-router'
import ChatView from '../views/ChatView.vue'
import SettingsView from '../views/SettingsView.vue'
import LoginView from '../views/LoginView.vue'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView, meta: { public: true } },
    { path: '/', component: ChatView },
    { path: '/settings', component: SettingsView },
    { path: '/admin', component: () => import('../views/AdminView.vue') }
  ]
})

router.beforeEach((to, _from, next) => {
  const token = localStorage.getItem('deltachat-token')
  if (!to.meta.public && !token) {
    next('/login')
  } else if (to.path === '/login' && token) {
    next('/')
  } else {
    next()
  }
})

export default router
