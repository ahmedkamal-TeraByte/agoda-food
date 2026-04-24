<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import { fetchMe, updateMe } from '../services/api'
import { useUserStore } from '../stores/user'

const router = useRouter()
const userStore = useUserStore()

const form = ref({
  displayName: '',
  email: '',
  phone: '',
  deliveryLocation: '',
})

const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)
const success = ref(false)

onMounted(async () => {
  if (!userStore.isLoggedIn) {
    router.replace({ path: '/login', query: { redirect: '/profile' } })
    return
  }
  try {
    const me = await fetchMe()
    userStore.updateUser(me)
    form.value.displayName = me.displayName
    form.value.email = me.email ?? ''
    form.value.phone = me.phone ?? ''
    form.value.deliveryLocation = me.deliveryLocation ?? ''
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load profile'
  } finally {
    loading.value = false
  }
})

async function save() {
  saving.value = true
  error.value = null
  success.value = false
  try {
    const updated = await updateMe({
      displayName: form.value.displayName.trim(),
      email: form.value.email.trim(),
      phone: form.value.phone.trim(),
      deliveryLocation: form.value.deliveryLocation.trim() || undefined,
    })
    userStore.updateUser(updated)
    form.value.displayName = updated.displayName
    form.value.email = updated.email ?? ''
    form.value.phone = updated.phone ?? ''
    form.value.deliveryLocation = updated.deliveryLocation ?? ''
    success.value = true
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to save'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <AppHeader />

    <div class="max-w-2xl mx-auto px-4 py-6">
      <div class="flex items-center gap-3 mb-6">
        <button @click="router.back()" class="text-brand-500 text-sm">← Back</button>
        <h1 class="font-bold text-gray-900 text-xl">Profile</h1>
      </div>

      <div v-if="loading" class="bg-white rounded-2xl shadow-sm p-8 animate-pulse">
        <div class="h-4 w-32 bg-gray-200 rounded mb-3" />
        <div class="h-10 bg-gray-100 rounded mb-4" />
        <div class="h-4 w-32 bg-gray-200 rounded mb-3" />
        <div class="h-10 bg-gray-100 rounded" />
      </div>

      <form
        v-else
        class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4"
        @submit.prevent="save"
      >
        <div class="flex items-center gap-3 pb-3 border-b border-gray-100">
          <span class="w-12 h-12 rounded-full bg-brand-500 text-white flex items-center justify-center text-lg font-bold">
            {{ form.displayName.charAt(0).toUpperCase() }}
          </span>
          <div class="min-w-0">
            <p class="font-semibold text-gray-900 truncate">{{ userStore.user?.displayName }}</p>
            <p class="text-xs text-gray-400 truncate">{{ userStore.user?.email }}</p>
          </div>
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Display name *</label>
          <input
            v-model="form.displayName"
            type="text"
            required
            class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
          <input
            v-model="form.email"
            type="email"
            required
            class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Phone *</label>
          <input
            v-model="form.phone"
            type="tel"
            required
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
        <div v-if="success" class="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-3 py-2">
          Saved ✓
        </div>

        <button
          type="submit"
          :disabled="saving"
          class="w-full bg-brand-500 disabled:opacity-60 text-white rounded-xl py-3 font-semibold"
        >
          {{ saving ? 'Saving…' : 'Save changes' }}
        </button>
      </form>
    </div>
  </div>
</template>
