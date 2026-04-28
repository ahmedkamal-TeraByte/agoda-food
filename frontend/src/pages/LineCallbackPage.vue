<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { exchangeLineCode, setAuthToken } from '../services/api'
import { useUserStore } from '../stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const error = ref<string | null>(null)

onMounted(async () => {
  const code = route.query.code as string | undefined
  const state = route.query.state as string | undefined

  // Error returned directly by LINE (user denied, etc.)
  const lineError = route.query.error as string | undefined
  if (lineError) {
    error.value = route.query.error_description as string ?? 'LINE login was cancelled.'
    return
  }

  if (!code || !state) {
    error.value = 'Missing code or state from LINE.'
    return
  }

  // State is verified server-side against the HttpOnly cookie set by
  // /api/auth/line/start. We just forward what LINE gave us.
  try {
    const { token, user, needsOnboarding, redirectAfterLogin } = await exchangeLineCode({
      code,
      state,
    })
    userStore.setSession(user, token)
    setAuthToken(token)

    const dest = redirectAfterLogin || '/'
    if (needsOnboarding) {
      router.replace({ path: '/onboarding', query: { redirect: dest } })
    } else {
      router.replace(dest)
    }
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Login failed. Please try again.'
  }
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-col items-center justify-center px-4">
    <!-- Loading -->
    <div v-if="!error" class="text-center space-y-4">
      <div class="w-16 h-16 rounded-full bg-[#06C755] flex items-center justify-center mx-auto animate-pulse">
        <span class="text-white text-2xl">🍱</span>
      </div>
      <p class="text-gray-600 font-medium">Signing you in…</p>
      <p class="text-gray-400 text-sm">Just a moment</p>
    </div>

    <!-- Error -->
    <div v-else class="text-center max-w-sm space-y-4">
      <div class="text-5xl">⚠️</div>
      <h2 class="font-bold text-gray-900 text-lg">Sign-in failed</h2>
      <p class="text-gray-500 text-sm">{{ error }}</p>
      <button
        @click="$router.replace('/login')"
        class="bg-brand-500 text-white px-6 py-3 rounded-2xl font-semibold"
      >
        Back to login
      </button>
    </div>
  </div>
</template>
