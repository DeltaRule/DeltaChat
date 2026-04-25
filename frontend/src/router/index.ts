import { createRouter, createWebHistory } from 'vue-router'
import ChatView from '../views/ChatView.vue'
import SettingsView from '../views/SettingsView.vue'
import LoginView from '../views/LoginView.vue'
import { useAuthStore } from '../stores/auth'

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', component: LoginView, meta: { public: true } },
    { path: '/', component: ChatView, meta: { requiresAuth: true } },
    { path: '/settings', component: SettingsView, meta: { requiresAuth: true } },
    {
      path: '/knowledge',
      component: () => import('../views/KnowledgeView.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/admin',
      component: () => import('../views/AdminView.vue'),
      meta: { requiresAuth: true, requiresAdmin: true },
    },
  ],
})

router.beforeEach((to, _from, next) => {
  try {
    const auth = useAuthStore()
    const isAuthenticated = !!auth.token
    const isAdmin = auth.isAdmin

    if (to.meta.public && isAuthenticated) return next('/')
    if (to.meta.requiresAuth && !isAuthenticated) return next('/login')
    if (to.meta.requiresAdmin && !isAdmin) return next('/')
    return next()
  } catch {
    // Store not ready during bootstrap — fall back to basic token check from user cache
    const savedUser = localStorage.getItem('deltachat-user')
    const isAuthenticated = !!savedUser

    if (to.meta.public && isAuthenticated) return next('/')
    if (to.meta.requiresAuth && !isAuthenticated) return next('/login')
    return next()
  }
})

export default router
