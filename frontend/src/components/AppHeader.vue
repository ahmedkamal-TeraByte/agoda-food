<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount } from 'vue'
import { useCartStore } from '../stores/cart'
import { useUserStore } from '../stores/user'
import { useRouter } from 'vue-router'
import { setAuthToken } from '../services/api'
import { isInLineClient, liffLogout } from '../lib/liff'
import { computed } from 'vue'

const cart = useCartStore()
const user = useUserStore()
const router = useRouter()

const isMerchant = computed(() => user.isMerchant)

const menuOpen = ref(false)
const menuRoot = ref<HTMLElement | null>(null)

function toggleMenu() {
  menuOpen.value = !menuOpen.value
}

function closeMenu() {
  menuOpen.value = false
}

function go(path: string) {
  closeMenu()
  router.push(path)
}

function logout() {
  if (isInLineClient()) liffLogout()
  user.clear()
  setAuthToken(null)
  cart.clearCart()
  closeMenu()
  router.push('/')
}

// Close on outside click. A DOM listener is used instead of a full-screen
// overlay so the overlay can't accidentally cover the dropdown buttons (the
// header is a new stacking context, so overlay z-index vs dropdown z-index
// would be fiddly).
function handleDocClick(e: MouseEvent) {
  if (!menuOpen.value) return
  const root = menuRoot.value
  if (root && !root.contains(e.target as Node)) {
    menuOpen.value = false
  }
}

onMounted(() => document.addEventListener('click', handleDocClick))
onBeforeUnmount(() => document.removeEventListener('click', handleDocClick))
</script>

<template>
  <header class="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
    <div class="max-w-2xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
      <button @click="router.push('/')" class="flex items-center gap-2">
        <img src="/agoda-food-log.png" alt="Agoda Food" class="w-8 h-8 object-contain" />
        <span class="font-bold text-gray-900 text-lg">Agoda Food</span>
      </button>

      <div class="flex items-center gap-2">
        <!-- User chip (logged in) or Log in button (guest) -->
        <div v-if="user.isLoggedIn" ref="menuRoot" class="relative">
          <button
            @click="toggleMenu"
            class="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded-full text-sm font-medium"
          >
            <img
              v-if="user.user!.pictureUrl"
              :src="user.user!.pictureUrl"
              class="w-6 h-6 rounded-full object-cover"
              alt="avatar"
            />
            <span
              v-else
              class="w-6 h-6 rounded-full bg-brand-500 text-white flex items-center justify-center text-xs font-bold"
            >
              {{ user.user!.displayName.charAt(0).toUpperCase() }}
            </span>
            <span class="hidden sm:inline">{{ user.user!.displayName }}</span>
            <span class="text-xs text-gray-400">▾</span>
          </button>

          <!-- Dropdown -->
          <div
            v-if="menuOpen"
            class="absolute right-0 mt-2 w-52 bg-white rounded-xl border border-gray-100 shadow-lg py-2 text-sm"
          >
            <div class="px-4 py-2 border-b border-gray-100">
              <p class="font-semibold text-gray-900">{{ user.user!.displayName }}</p>
              <p class="text-xs text-gray-500 truncate">{{ user.user!.email }}</p>
            </div>
            <button @click="go('/profile')" class="w-full text-left px-4 py-2 hover:bg-gray-50">
              Profile
            </button>
            <button @click="go('/orders')" class="w-full text-left px-4 py-2 hover:bg-gray-50">
              My orders
            </button>
            <button @click="go('/help')" class="w-full text-left px-4 py-2 hover:bg-gray-50">
              Help &amp; FAQ
            </button>
            <button v-if="isMerchant" @click="go('/merchant')" class="w-full text-left px-4 py-2 hover:bg-gray-50 text-brand-600 font-medium">
              Merchant dashboard
            </button>
            <button v-else @click="go('/restaurants/apply')" class="w-full text-left px-4 py-2 hover:bg-gray-50 text-gray-600">
              Open a restaurant
            </button>
            <!-- LINE in-app webview can't actually sign out — the user's
                 identity is the LINE app itself, and our boot() auto-relogins
                 on the next reload. Hide the button there to avoid confusion. -->
            <button
              v-if="!isInLineClient()"
              @click="logout"
              class="w-full text-left px-4 py-2 hover:bg-gray-50 text-red-600 border-t border-gray-100"
            >
              Log out
            </button>
          </div>
        </div>

        <button
          v-else
          @click="router.push('/login')"
          class="bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded-full text-sm font-medium"
        >
          Log in
        </button>

        <button
          @click="router.push('/help')"
          class="flex items-center gap-1.5 bg-gray-100 hover:bg-gray-200 text-gray-800 px-3 py-1.5 rounded-full text-sm font-medium"
          aria-label="Help and FAQ"
          title="Help &amp; FAQ"
        >
          <span aria-hidden="true">❓</span>
          <span class="hidden sm:inline">Help</span>
        </button>

        <button
          @click="router.push('/cart')"
          class="relative flex items-center gap-1.5 bg-brand-500 text-white px-4 py-2 rounded-full text-sm font-medium active:scale-95 transition-transform"
          :class="{ 'opacity-50 cursor-default': cart.totalItems === 0 }"
        >
          <span>🛒</span>
          <span class="hidden sm:inline">Cart</span>
          <span
            v-if="cart.totalItems > 0"
            class="absolute -top-1.5 -right-1.5 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-bold"
          >
            {{ cart.totalItems }}
          </span>
        </button>
      </div>
    </div>
  </header>
</template>
