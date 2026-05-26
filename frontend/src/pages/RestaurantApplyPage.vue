<script setup lang="ts">
import { reactive, ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import AppHeader from '../components/AppHeader.vue'
import { applyForRestaurant, sendApplyOtp } from '../services/api'
import { useUserStore } from '../stores/user'

const router = useRouter()
const user = useUserStore()

// Onboarding intentionally captures the bare minimum — name, cuisine, and a
// referral. Cover photo / logo are added later from the merchant settings tab.
const form = reactive({
  name: '',
  cuisine: '',
  referralName: '',
  referralEmail: '',
})

// `otpSent` flips to true once the backend has emailed the code. Until then
// the OTP input is hidden and the email field is editable.
const otpSent = ref(false)
const otpCode = ref('')

const sending = ref(false)
const submitting = ref(false)
const error = ref<string | null>(null)
const info = ref<string | null>(null)

onMounted(() => {
  if (!user.isLoggedIn) {
    router.replace({ path: '/login', query: { redirect: '/restaurants/apply' } })
  }
})

function validateForm(): boolean {
  if (!form.name.trim() || !form.cuisine.trim()) {
    error.value = 'Restaurant name and cuisine are required'
    return false
  }
  if (!form.referralName.trim() || !form.referralEmail.trim()) {
    error.value = 'Referral name and email are required'
    return false
  }
  return true
}

function describeError(e: unknown, fallback: string): string {
  const err = e as Error & { code?: string }
  if (err.code === 'OTP_INVALID') return 'Invalid or expired code. Please try again.'
  if (err.code === 'ALREADY_HAS_RESTAURANT') return 'You already have a restaurant.'
  if (err.code === 'INVALID_REFERRAL_DOMAIN' && err.message) return err.message
  return e instanceof Error ? e.message : fallback
}

async function sendOtp() {
  error.value = null
  info.value = null
  if (!validateForm()) return

  sending.value = true
  try {
    await sendApplyOtp(form.referralEmail.trim())
    otpSent.value = true
    info.value = `We sent a 6-digit code to ${form.referralEmail.trim()}.`
  } catch (e) {
    error.value = describeError(e, 'Could not send verification code')
  } finally {
    sending.value = false
  }
}

async function resendOtp() {
  otpCode.value = ''
  await sendOtp()
}

function resetEmail() {
  otpSent.value = false
  otpCode.value = ''
  info.value = null
  error.value = null
}

async function submit() {
  error.value = null
  info.value = null
  if (!validateForm()) return
  if (!otpSent.value) {
    // Should never happen — the button label switches to "Send code" until
    // we've sent one — but guard just in case.
    return sendOtp()
  }
  if (!otpCode.value.trim()) {
    error.value = 'Please enter the verification code'
    return
  }

  submitting.value = true
  try {
    const { user: updatedUser } = await applyForRestaurant({
      name: form.name.trim(),
      cuisine: form.cuisine.trim(),
      referral: { name: form.referralName.trim(), email: form.referralEmail.trim() },
      code: otpCode.value.trim(),
    })
    user.updateUser(updatedUser)
    router.push('/merchant')
  } catch (e) {
    error.value = describeError(e, 'Verification failed')
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <AppHeader />

    <div class="max-w-md mx-auto px-4 py-10">
      <div class="text-center mb-8">
        <div class="text-5xl mb-3">🍽️</div>
        <h1 class="text-2xl font-bold text-gray-900 mb-1">Open your restaurant</h1>
        <p class="text-gray-500 text-sm">
          List your restaurant on Agoda Food. You'll need a referral from an Agoda employee.
        </p>
      </div>

      <form
        class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4"
        @submit.prevent="submit"
      >
        <h2 class="font-semibold text-gray-800">Restaurant details</h2>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Restaurant name *</label>
          <input
            v-model="form.name"
            type="text"
            placeholder="e.g. Som Tam Place"
            required
            class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
        </div>

        <div>
          <label class="block text-sm font-medium text-gray-700 mb-1.5">Cuisine type *</label>
          <input
            v-model="form.cuisine"
            type="text"
            placeholder="e.g. Thai, Japanese, Italian"
            required
            class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
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
              <input
                v-model="form.referralName"
                type="text"
                placeholder="e.g. Alice Smith"
                required
                class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Referral Agoda email *</label>
              <div class="flex gap-2">
                <input
                  v-model="form.referralEmail"
                  type="email"
                  placeholder="alice@agoda.com"
                  required
                  :disabled="otpSent"
                  class="flex-1 border border-gray-200 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 disabled:bg-gray-50 disabled:text-gray-500"
                />
                <button
                  v-if="otpSent"
                  type="button"
                  class="text-sm text-brand-600 hover:text-brand-700 px-2"
                  @click="resetEmail"
                >Change</button>
              </div>
            </div>

            <!-- OTP input + resend, visible after the code is sent -->
            <div v-if="otpSent" class="border-t border-gray-100 pt-3">
              <label class="block text-sm font-medium text-gray-700 mb-1.5">
                6-digit verification code *
              </label>
              <input
                v-model="otpCode"
                type="text"
                inputmode="numeric"
                maxlength="6"
                placeholder="123456"
                class="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono tracking-widest focus:outline-none focus:ring-2 focus:ring-brand-300"
              />
              <div class="flex items-center justify-between mt-2">
                <p class="text-xs text-gray-400">
                  Ask your referral to share the code (in dev, check the server console).
                </p>
                <button
                  type="button"
                  :disabled="sending"
                  class="text-xs text-brand-600 hover:text-brand-700 disabled:opacity-60"
                  @click="resendOtp"
                >
                  {{ sending ? 'Sending…' : 'Resend' }}
                </button>
              </div>
            </div>
          </div>
        </div>

        <div
          v-if="error"
          class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2"
        >{{ error }}</div>

        <div
          v-else-if="info"
          class="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-xl px-3 py-2"
        >{{ info }}</div>

        <!-- Primary action: "Send code" before OTP is sent, "Verify & create" after -->
        <button
          v-if="!otpSent"
          type="button"
          :disabled="sending"
          class="w-full bg-brand-500 disabled:opacity-60 text-white rounded-xl py-3 font-semibold"
          @click="sendOtp"
        >
          {{ sending ? 'Sending code…' : 'Send verification code' }}
        </button>
        <button
          v-else
          type="submit"
          :disabled="submitting"
          class="w-full bg-brand-500 disabled:opacity-60 text-white rounded-xl py-3 font-semibold"
        >
          {{ submitting ? 'Verifying…' : 'Verify & create restaurant' }}
        </button>
      </form>
    </div>
  </div>
</template>
