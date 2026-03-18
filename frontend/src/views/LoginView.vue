<template>
  <div class="min-h-screen flex items-center justify-center bg-background p-4">
    <div class="w-full max-w-md">
      <div class="text-center mb-8">
        <div
          class="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg mb-4"
        >
          <Triangle class="h-6 w-6" />
        </div>
        <h1 class="text-2xl font-bold text-foreground">DeltaChat</h1>
        <p class="text-sm text-muted-foreground mt-1">
          {{ isRegister ? 'Create your account' : 'Sign in to continue' }}
        </p>
      </div>

      <div class="rounded-xl border border-border bg-card p-6 shadow-lg space-y-5">
        <!-- Error message -->
        <div
          v-if="error"
          class="rounded-lg bg-destructive/10 text-destructive text-sm px-4 py-3 flex items-center gap-2"
        >
          <AlertCircle class="h-4 w-4 shrink-0" />
          <span>{{ error }}</span>
        </div>

        <form class="space-y-4" @submit.prevent="handleSubmit">
          <!-- Name field (register only) -->
          <div v-if="isRegister" class="space-y-2">
            <Label for="name">Name</Label>
            <Input
              id="name"
              v-model="form.name"
              placeholder="Your name"
              required
              autocomplete="name"
            />
          </div>

          <!-- Email -->
          <div class="space-y-2">
            <Label for="email">Email</Label>
            <Input
              id="email"
              v-model="form.email"
              type="email"
              placeholder="you@example.com"
              required
              autocomplete="email"
            />
          </div>

          <!-- Password -->
          <div class="space-y-2">
            <Label for="password">Password</Label>
            <Input
              id="password"
              v-model="form.password"
              type="password"
              placeholder="••••••••"
              required
              autocomplete="current-password"
              :minlength="isRegister ? 8 : undefined"
            />
            <p v-if="isRegister" class="text-xs text-muted-foreground">Minimum 8 characters</p>
          </div>

          <Button type="submit" class="w-full" :disabled="loading">
            <Loader2 v-if="loading" class="h-4 w-4 animate-spin mr-2" />
            {{ isRegister ? 'Create Account' : 'Sign In' }}
          </Button>
        </form>

        <!-- Divider -->
        <div v-if="googleEnabled" class="relative">
          <div class="absolute inset-0 flex items-center">
            <Separator />
          </div>
          <div class="relative flex justify-center text-xs uppercase">
            <span class="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <!-- Google Sign-In -->
        <Button
          v-if="googleEnabled"
          variant="outline"
          class="w-full"
          :disabled="loading"
          @click="handleGoogleLogin"
        >
          <svg class="h-4 w-4 mr-2" viewBox="0 0 24 24">
            <path
              d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
              fill="#4285F4"
            />
            <path
              d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
              fill="#34A853"
            />
            <path
              d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
              fill="#FBBC05"
            />
            <path
              d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
              fill="#EA4335"
            />
          </svg>
          Sign in with Google
        </Button>

        <!-- Toggle register/login -->
        <p class="text-center text-sm text-muted-foreground">
          <span v-if="isRegister">Already have an account?</span>
          <span v-else>Don't have an account?</span>
          <Button
            type="button"
            variant="link"
            class="ml-1 text-primary font-medium p-0 h-auto"
            @click="toggleMode"
          >
            {{ isRegister ? 'Sign In' : 'Create Account' }}
          </Button>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Triangle, AlertCircle, Loader2 } from 'lucide-vue-next'
import { Button } from '../components/ui/button'
import { Input } from '../components/ui/input'
import { Label } from '../components/ui/label'
import { Separator } from '../components/ui/separator'
import { useAuthStore } from '../stores/auth'
import { API_URL } from '../lib/api'

const router = useRouter()
const authStore = useAuthStore()

const isRegister = ref(false)
const loading = ref(false)
const error = ref('')
const googleEnabled = ref(false)
const googleClientId = ref('')

const form = ref({
  name: '',
  email: '',
  password: '',
})

function toggleMode() {
  isRegister.value = !isRegister.value
  error.value = ''
}

async function handleSubmit() {
  loading.value = true
  error.value = ''
  try {
    if (isRegister.value) {
      await authStore.register(form.value.email, form.value.password, form.value.name)
    } else {
      await authStore.login(form.value.email, form.value.password)
    }
    router.push('/')
  } catch (e: any) {
    error.value = e.response?.data?.error || e.message || 'Authentication failed'
  } finally {
    loading.value = false
  }
}

async function handleGoogleLogin() {
  if (!googleClientId.value) return
  loading.value = true
  error.value = ''
  try {
    // Use Google Identity Services to get ID token
    const google = (window as any).google
    if (!google?.accounts?.id) {
      error.value = 'Google Sign-In not loaded'
      return
    }
    google.accounts.id.initialize({
      client_id: googleClientId.value,
      callback: async (response: any) => {
        try {
          await authStore.googleLogin(response.credential)
          router.push('/')
        } catch (e: any) {
          error.value = e.response?.data?.error || e.message || 'Google authentication failed'
        } finally {
          loading.value = false
        }
      },
    })
    google.accounts.id.prompt()
  } catch (e) {
    error.value = 'Failed to initialize Google Sign-In'
    loading.value = false
  }
}

onMounted(async () => {
  // Redirect if already authenticated
  if (authStore.isAuthenticated) {
    router.push('/')
    return
  }

  // Check if Google auth is configured by checking settings
  try {
    const res = await fetch(`${API_URL}/api/auth/google-enabled`)
    if (res.ok) {
      const data = await res.json()
      googleEnabled.value = data.enabled
      googleClientId.value = data.clientId || ''
      if (data.enabled && data.clientId) {
        // Load Google Identity Services script
        const script = document.createElement('script')
        script.src = 'https://accounts.google.com/gsi/client'
        script.async = true
        document.head.appendChild(script)
      }
    }
  } catch {
    /* Google auth not available */
  }
})
</script>
