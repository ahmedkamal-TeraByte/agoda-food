<script setup lang="ts">
import { useRoute, useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import { buildLineAuthorizeUrl } from '../lib/oauth'
import { useUserStore } from '../stores/user'

const route = useRoute()
const router = useRouter()
const user = useUserStore()

// If somehow already logged in and not needing onboarding, go home.
if (user.isLoggedIn && !user.needsOnboarding) {
  router.replace('/')
}

const redirectAfterLogin =
  typeof route.query.redirect === 'string' ? route.query.redirect : '/'

function loginWithLine() {
  const url = buildLineAuthorizeUrl(redirectAfterLogin)
  window.location.href = url
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <AppHeader />

    <div class="max-w-md mx-auto px-4 py-16">
      <div class="text-center mb-10">
        <div class="text-6xl mb-4">🍱</div>
        <h1 class="text-2xl font-bold text-gray-900 mb-2">Welcome to Agoda Food</h1>
        <p class="text-gray-500 text-sm">Sign in with your LINE account to place an order.<br />You can browse restaurants without logging in.</p>
      </div>

      <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col items-center gap-4">
        <button
          @click="loginWithLine"
          class="w-full flex items-center justify-center gap-3 bg-[#06C755] hover:bg-[#05b34d] text-white font-semibold py-3.5 rounded-xl text-base transition-colors"
        >
          <svg width="24" height="24" viewBox="0 0 24 24" fill="white" xmlns="http://www.w3.org/2000/svg">
            <path d="M19.365 9.863c.349 0 .63.285.63.631 0 .345-.281.63-.63.63H17.61v1.125h1.755c.349 0 .63.283.63.63 0 .344-.281.629-.63.629h-2.386c-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63h2.386c.349 0 .63.285.63.63 0 .349-.281.63-.63.63H17.61v1.125h1.755zm-3.855 3.016c0 .27-.174.51-.432.596-.064.021-.133.031-.199.031-.211 0-.391-.09-.51-.25l-2.443-3.317v2.94c0 .344-.279.629-.631.629-.346 0-.626-.285-.626-.629V8.108c0-.27.173-.51.43-.595.06-.023.136-.033.194-.033.195 0 .375.104.495.254l2.462 3.33V8.108c0-.345.282-.63.63-.63.345 0 .63.285.63.63v4.771zm-5.741 0c0 .344-.282.629-.631.629-.345 0-.627-.285-.627-.629V8.108c0-.345.282-.63.627-.63.349 0 .631.285.631.63v4.771zm-2.466.629H4.917c-.345 0-.63-.285-.63-.629V8.108c0-.345.285-.63.63-.63.348 0 .63.285.63.63v4.141h1.756c.348 0 .629.283.629.63 0 .344-.281.629-.629.629M24 10.314C24 4.943 18.615.572 12 .572S0 4.943 0 10.314c0 4.811 4.27 8.842 10.035 9.608.391.082.923.258 1.058.59.12.301.079.766.038 1.08l-.164 1.02c-.045.301-.24 1.186 1.049.645 1.291-.539 6.916-4.078 9.436-6.975C23.176 14.393 24 12.458 24 10.314"/>
          </svg>
          <span>Log in with LINE</span>
        </button>

        <p class="text-xs text-gray-400 text-center">
          First time? An account will be created automatically.
        </p>
      </div>
    </div>
  </div>
</template>
