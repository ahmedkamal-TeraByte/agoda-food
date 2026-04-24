import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import type { User } from '../data/types'

const STORAGE_KEY = 'agoda-food:session'

interface StoredSession {
  user: User
  token: string
}

function readStoredSession(): StoredSession | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as StoredSession
  } catch {
    return null
  }
}

export const useUserStore = defineStore('user', () => {
  const stored = readStoredSession()

  const user = ref<User | null>(stored?.user ?? null)
  const token = ref<string | null>(stored?.token ?? null)

  const isLoggedIn = computed(() => user.value !== null && token.value !== null)

  const needsOnboarding = computed(
    () => isLoggedIn.value && (!user.value?.email || !user.value?.phone),
  )

  function setSession(nextUser: User, nextToken: string) {
    user.value = nextUser
    token.value = nextToken
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: nextUser, token: nextToken }))
  }

  function updateUser(nextUser: User) {
    user.value = nextUser
    if (token.value) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: nextUser, token: token.value }))
    }
  }

  function clear() {
    user.value = null
    token.value = null
    localStorage.removeItem(STORAGE_KEY)
  }

  return {
    user,
    token,
    isLoggedIn,
    needsOnboarding,
    setSession,
    updateUser,
    clear,
  }
})
