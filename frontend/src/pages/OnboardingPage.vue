<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { updateMe, fetchMe } from '../services/api'
import { useUserStore } from '../stores/user'

const route = useRoute()
const router = useRouter()
const userStore = useUserStore()

const form = reactive({
  email: userStore.user?.email ?? '',
  phone: userStore.user?.phone ?? '',
  deliveryLocation: userStore.user?.deliveryLocation ?? '',
})

const saving = ref(false)
const error = ref<string | null>(null)

onMounted(() => {
  if (!userStore.isLoggedIn) {
    router.replace('/login')
  }
})

async function save() {
  if (!form.email.trim() || !form.phone.trim()) {
    error.value = 'Email and phone are required.'
    return
  }
  saving.value = true
  error.value = null
  try {
    await updateMe({
      email: form.email.trim(),
      phone: form.phone.trim(),
      deliveryLocation: form.deliveryLocation.trim() || undefined,
    })
    // Re-fetch so needsOnboarding is recomputed from the latest server state.
    const me = await fetchMe()
    userStore.updateUser(me)

    const redirect = typeof route.query.redirect === 'string' ? route.query.redirect : '/'
    router.replace(redirect)
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to save'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <header class="sticky top-0 z-50 bg-white border-b border-gray-200 shadow-sm">
      <div class="max-w-2xl mx-auto px-4 h-14 flex items-center gap-2">
        <span class="text-2xl">🍱</span>
        <span class="font-bold text-gray-900 text-lg">Agoda Food</span>
      </div>
    </header>

    <div class="max-w-md mx-auto px-4 py-10">
      <div class="text-center mb-8">
        <div class="text-5xl mb-3">👤</div>
        <h1 class="text-2xl font-bold text-gray-900 mb-1">Complete your profile</h1>
        <p class="text-gray-500 text-sm">We need your email and phone to deliver your lunch.</p>
      </div>

      <form
        class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4"
        @submit.prevent="save"
      >
        <div v-if="userStore.user?.displayName" class="flex items-center gap-3 pb-3 border-b border-gray-100">
          <img
            v-if="userStore.user.pictureUrl"
            :src="userStore.user.pictureUrl"
            class="w-10 h-10 rounded-full object-cover"
            alt="Profile"
          />
          <span v-else class="w-10 h-10 rounded-full bg-brand-500 text-white flex items-center justify-center font-bold">
            {{ userStore.user.displayName.charAt(0).toUpperCase() }}
          </span>
          <span class="font-semibold text-gray-900">{{ userStore.user.displayName }}</span>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
          <input
            v-model="form.email"
            type="email"
            required
            placeholder="you@agoda.com"
            class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Phone *</label>
          <input
            v-model="form.phone"
            type="tel"
            required
            placeholder="+66 81 234 5678"
            class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Delivery location</label>
          <input
            v-model="form.deliveryLocation"
            type="text"
            placeholder="e.g. Agoda HQ — Floor 27"
            class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
        </div>

        <div v-if="error" class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2">
          {{ error }}
        </div>

        <button
          type="submit"
          :disabled="saving"
          class="w-full bg-brand-500 disabled:opacity-60 text-white rounded-xl py-3 font-semibold"
        >
          {{ saving ? 'Saving…' : 'Continue' }}
        </button>
      </form>
    </div>
  </div>
</template>
