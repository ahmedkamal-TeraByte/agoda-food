import { createApp, watch } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { router } from './router'
import { useUserStore } from './stores/user'
import { setAuthToken, fetchMe, verifyLiffToken } from './services/api'
import { initLiff, isInLineClient, isLiffLoggedIn, liffLogin, getLiffIdToken } from './lib/liff'
import './style.css'

const app = createApp(App)
app.use(createPinia())
app.use(router)

const userStore = useUserStore()

// Keep the Bearer header in sync with the store. Pinia auto-unwraps refs
// accessed via the store, so `userStore.token` is already `string | null`.
setAuthToken(userStore.token)
watch(
  () => userStore.token,
  (t) => setAuthToken(t),
)

async function boot() {
  // 1. If we have a stored token, verify it's still valid.
  if (userStore.token) {
    try {
      const me = await fetchMe()
      userStore.updateUser(me)
    } catch {
      // JWT expired or user deleted — start fresh.
      userStore.clear()
      setAuthToken(null)
    }
  }

  // 2. If still not logged in and LIFF is configured, try auto-login inside LINE.
  if (!userStore.isLoggedIn) {
    try {
      await initLiff()
      if (isInLineClient()) {
        if (!isLiffLoggedIn()) {
          // Trigger LIFF login redirect — the page will reload and return here authed.
          liffLogin()
          return // don't mount until reload
        }
        const idToken = getLiffIdToken()
        if (idToken) {
          const { token, user } = await verifyLiffToken(idToken)
          userStore.setSession(user, token)
          setAuthToken(token)
        }
      }
    } catch (err) {
      // LIFF init / verify failed — fall through as guest, user can still tap Login.
      console.warn('[LIFF] boot error, falling back to guest:', err)
    }
  }
}

boot().finally(() => app.mount('#app'))
