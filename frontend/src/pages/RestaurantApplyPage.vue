<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import { applyForRestaurant, verifyReferral } from '../services/api'
import { useUserStore } from '../stores/user'

const router = useRouter()
const user = useUserStore()

type Step = 'form' | 'otp'
const step = ref<Step>('form')
const restaurantId = ref<string | null>(null)

// Onboarding intentionally captures the bare minimum — name, cuisine, and a
// referral. Cover photo / logo are added later from the merchant settings tab.
const form = reactive({
  name: '',
  cuisine: '',
  referralName: '',
  referralEmail: '',
})

const submitting = ref(false)
const formError = ref<string | null>(null)

const otpCode = ref('')
const verifying = ref(false)
const otpError = ref<string | null>(null)

onMounted(() => {
  if (!user.isLoggedIn) {
    router.replace({ path: '/login', query: { redirect: '/restaurants/apply' } })
  }
})

async function submitApplication() {
  if (!form.name.trim() || !form.cuisine.trim()) {
    formError.value = 'Restaurant name and cuisine are required'
    return
  }
  if (!form.referralName.trim() || !form.referralEmail.trim()) {
    formError.value = 'Referral name and email are required'
    return
  }

  submitting.value = true
  formError.value = null

  try {
    const restaurant = await applyForRestaurant({
      name: form.name.trim(),
      cuisine: form.cuisine.trim(),
      referral: { name: form.referralName.trim(), email: form.referralEmail.trim() },
    })
    restaurantId.value = restaurant.id
    step.value = 'otp'
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Application failed'
  } finally {
    submitting.value = false
  }
}

async function submitOtp() {
  if (!otpCode.value.trim() || !restaurantId.value) {
    otpError.value = 'Please enter the code'
    return
  }

  verifying.value = true
  otpError.value = null

  try {
    const { user: updatedUser } = await verifyReferral(restaurantId.value, otpCode.value.trim())
    user.updateUser(updatedUser)
    router.push('/merchant')
  } catch (e) {
    const err = e as Error & { code?: string }
    if (err.code === 'OTP_INVALID') {
      otpError.value = 'Invalid or expired code. Please try again.'
    } else {
      otpError.value = e instanceof Error ? e.message : 'Verification failed'
    }
  } finally {
    verifying.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <AppHeader />

    <div class="max-w-md mx-auto px-4 py-10">
      <!-- Step indicator -->
      <div class="flex items-center gap-3 justify-center mb-8">
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
          :class="step === 'form' ? 'bg-brand-500 text-white' : 'bg-brand-100 text-brand-600'"
        >1</div>
        <div class="h-0.5 w-12 bg-gray-200" />
        <div
          class="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
          :class="step === 'otp' ? 'bg-brand-500 text-white' : 'bg-gray-100 text-gray-400'"
        >2</div>
      </div>

      <!-- Step 1: Application form -->
      <div v-if="step === 'form'">
        <div class="text-center mb-8">
          <div class="text-5xl mb-3">🍽️</div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">Open your restaurant</h1>
          <p class="text-gray-500 text-sm">
            List your restaurant on Agoda Food. You'll need a referral from an Agoda employee.
          </p>
        </div>

        <form class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4" @submit.prevent="submitApplication">
          <h2 class="font-semibold text-gray-800">Restaurant details</h2>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Restaurant name *</label>
            <input v-model="form.name" type="text" placeholder="e.g. Som Tam Place" required
              class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Cuisine type *</label>
            <input v-model="form.cuisine" type="text" placeholder="e.g. Thai, Japanese, Italian" required
              class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </div>

          <p class="text-xs text-gray-400">
            You can add a cover photo and logo from the Settings tab once your restaurant is verified.
          </p>

          <div class="border-t border-gray-100 pt-4">
            <h2 class="font-semibold text-gray-800 mb-3">Agoda referral</h2>
            <p class="text-xs text-gray-500 mb-3">
              Ask an Agoda employee to refer you. We'll send them a verification code to their Agoda email.
            </p>

            <div class="space-y-3">
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Referral name *</label>
                <input v-model="form.referralName" type="text" placeholder="e.g. Alice Smith" required
                  class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <div>
                <label class="block text-sm font-medium text-gray-700 mb-1.5">Referral Agoda email *</label>
                <input v-model="form.referralEmail" type="email" placeholder="alice@agoda.com" required
                  class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
            </div>
          </div>

          <div v-if="formError" class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2">
            {{ formError }}
          </div>

          <button type="submit" :disabled="submitting"
            class="w-full bg-brand-500 disabled:opacity-60 text-white rounded-xl py-3 font-semibold">
            {{ submitting ? 'Submitting…' : 'Submit application' }}
          </button>
        </form>
      </div>

      <!-- Step 2: OTP verification -->
      <div v-if="step === 'otp'">
        <div class="text-center mb-8">
          <div class="text-5xl mb-3">📧</div>
          <h1 class="text-2xl font-bold text-gray-900 mb-1">Verify your referral</h1>
          <p class="text-gray-500 text-sm">
            A 6-digit code was sent to <strong>{{ form.referralEmail }}</strong>.
            Ask your referral to share it with you (in dev, check the server console).
          </p>
        </div>

        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">6-digit code</label>
            <input
              v-model="otpCode"
              type="text"
              inputmode="numeric"
              maxlength="6"
              placeholder="123456"
              class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
          </div>

          <div v-if="otpError" class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2">
            {{ otpError }}
          </div>

          <button @click="submitOtp" :disabled="verifying"
            class="w-full bg-brand-500 disabled:opacity-60 text-white rounded-xl py-3 font-semibold">
            {{ verifying ? 'Verifying…' : 'Verify & activate restaurant' }}
          </button>

          <button @click="step = 'form'" class="w-full text-gray-400 text-sm py-2 hover:text-gray-600">
            ← Back to form
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
