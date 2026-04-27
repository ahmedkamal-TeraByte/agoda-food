<script setup lang="ts">
import { ref, onMounted, reactive } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import MerchantTabs from '../components/MerchantTabs.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import {
  fetchMerchantRestaurant,
  updateMerchantRestaurant,
  fetchMerchantPromptPayQr,
  uploadMerchantPromptPayQr,
  deleteMerchantPromptPayQr,
  uploadMerchantImage,
} from '../services/api'
import type { Restaurant } from '../data/types'
import type { MerchantImageKind } from '../services/api'

const restaurant = ref<Restaurant | null>(null)
const loading = ref(true)
const saving = ref(false)
const error = ref<string | null>(null)
const saveError = ref<string | null>(null)
const saved = ref(false)

const form = reactive({
  name: '',
  cuisine: '',
  deliveryTime: '',
  deliveryFee: 0,
  minOrder: 0,
  openHour: 17,
  closeHour: 10,
  deliveryHour: 12,
})

// --- PromptPay QR onboarding ---
const qrImageUrl = ref<string | null>(null)
const qrConfigured = ref(false)
const qrUploading = ref(false)
const qrError = ref<string | null>(null)
const qrInputRef = ref<HTMLInputElement | null>(null)

const showRemoveQrModal = ref(false)
const removingQr = ref(false)
const removeQrError = ref<string | null>(null)

// --- Cover image / logo uploads ---
const coverInputRef = ref<HTMLInputElement | null>(null)
const logoInputRef = ref<HTMLInputElement | null>(null)
const coverUploading = ref(false)
const logoUploading = ref(false)
const coverError = ref<string | null>(null)
const logoError = ref<string | null>(null)

onMounted(async () => {
  try {
    const r = await fetchMerchantRestaurant()
    restaurant.value = r
    form.name = r.name
    form.cuisine = r.cuisine
    form.deliveryTime = r.deliveryTime
    form.deliveryFee = r.deliveryFee
    form.minOrder = r.minOrder
    form.openHour = r.orderWindow?.openHour ?? 17
    form.closeHour = r.orderWindow?.closeHour ?? 10
    form.deliveryHour = r.orderWindow?.deliveryHour ?? 12

    const qr = await fetchMerchantPromptPayQr()
    qrConfigured.value = qr.configured
    qrImageUrl.value = qr.qrImageUrl ?? null
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load restaurant'
  } finally {
    loading.value = false
  }
})

function pickQrFile() {
  qrInputRef.value?.click()
}

async function onQrFileChosen(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  qrError.value = null
  qrUploading.value = true
  try {
    const result = await uploadMerchantPromptPayQr(file)
    qrConfigured.value = result.configured
    qrImageUrl.value = result.qrImageUrl ?? null
  } catch (e) {
    qrError.value = e instanceof Error ? e.message : 'Could not read that QR code'
  } finally {
    qrUploading.value = false
    input.value = ''
  }
}

function requestRemoveQr() {
  removeQrError.value = null
  showRemoveQrModal.value = true
}

function dismissRemoveQrModal() {
  if (removingQr.value) return
  showRemoveQrModal.value = false
  removeQrError.value = null
}

/**
 * Upload a cover photo or logo, then persist the resulting URL on the
 * restaurant in a single PATCH so a page refresh keeps the new image.
 */
async function uploadPhoto(kind: MerchantImageKind, file: File) {
  const isCover = kind === 'restaurant-cover'
  const uploadingRef = isCover ? coverUploading : logoUploading
  const errorRef = isCover ? coverError : logoError
  const field = isCover ? 'imageUrl' : 'logoUrl'

  errorRef.value = null
  uploadingRef.value = true
  try {
    const { imageUrl } = await uploadMerchantImage(file, kind)
    const updated = await updateMerchantRestaurant({ [field]: imageUrl } as Partial<Restaurant>)
    restaurant.value = updated
  } catch (e) {
    errorRef.value = e instanceof Error ? e.message : 'Failed to upload photo'
  } finally {
    uploadingRef.value = false
  }
}

function pickCover() {
  coverInputRef.value?.click()
}

function pickLogo() {
  logoInputRef.value?.click()
}

async function onCoverChosen(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) await uploadPhoto('restaurant-cover', file)
  input.value = ''
}

async function onLogoChosen(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (file) await uploadPhoto('restaurant-logo', file)
  input.value = ''
}

async function confirmRemoveQr() {
  removingQr.value = true
  removeQrError.value = null
  try {
    const result = await deleteMerchantPromptPayQr()
    qrConfigured.value = result.configured
    qrImageUrl.value = null
    showRemoveQrModal.value = false
  } catch (e) {
    removeQrError.value = e instanceof Error ? e.message : 'Could not remove QR'
  } finally {
    removingQr.value = false
  }
}

async function save() {
  saving.value = true
  saveError.value = null
  saved.value = false
  try {
    const updated = await updateMerchantRestaurant({
      name: form.name,
      cuisine: form.cuisine,
      deliveryTime: form.deliveryTime,
      deliveryFee: form.deliveryFee,
      minOrder: form.minOrder,
      orderWindow: {
        openHour: form.openHour,
        closeHour: form.closeHour,
        deliveryHour: form.deliveryHour,
      },
    } as Partial<Restaurant>)
    restaurant.value = updated
    saved.value = true
    setTimeout(() => { saved.value = false }, 3000)
  } catch (e) {
    saveError.value = e instanceof Error ? e.message : 'Failed to save'
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <AppHeader />

    <div class="max-w-2xl mx-auto px-4 py-6">
      <MerchantTabs />

      <div v-if="loading" class="space-y-4">
        <div class="h-8 bg-gray-200 rounded animate-pulse w-48" />
        <div class="h-64 bg-white rounded-2xl animate-pulse border border-gray-100" />
      </div>

      <div v-else-if="error" class="text-center py-20">
        <div class="text-5xl mb-3">⚠️</div>
        <p class="text-gray-700 mb-4">{{ error }}</p>
      </div>

      <div v-else-if="restaurant">
        <div class="flex items-center justify-between mb-6">
          <div>
            <h1 class="text-xl font-bold text-gray-900">{{ restaurant.name }}</h1>
            <p class="text-gray-500 text-sm">{{ restaurant.cuisine }}</p>
          </div>
          <span
            class="text-xs font-medium px-3 py-1 rounded-full"
            :class="restaurant.isOpen ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
          >
            {{ restaurant.isOpen ? 'Open' : 'Closed' }}
          </span>
        </div>

        <form @submit.prevent="save" class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-5">
          <h2 class="font-semibold text-gray-800">Restaurant settings</h2>

          <div class="grid grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Name</label>
              <input v-model="form.name" type="text" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Cuisine</label>
              <input v-model="form.cuisine" type="text" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
          </div>

          <div class="grid grid-cols-3 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Delivery time</label>
              <input v-model="form.deliveryTime" type="text" placeholder="20–35 min" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Delivery fee (฿)</label>
              <input v-model.number="form.deliveryFee" type="number" min="0" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Min order (฿)</label>
              <input v-model.number="form.minOrder" type="number" min="0" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
          </div>

          <div class="border-t border-gray-100 pt-4">
            <h3 class="font-semibold text-gray-800 mb-1 text-sm">Order window (Asia/Bangkok)</h3>
            <p class="text-xs text-gray-400 mb-3">
              When openHour &gt; closeHour the window wraps midnight (e.g. 17:00 – 10:00 the next morning).
            </p>
            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Opens at (hour)</label>
                <input v-model.number="form.openHour" type="number" min="0" max="23" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Closes at (hour)</label>
                <input v-model.number="form.closeHour" type="number" min="0" max="23" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
              <div>
                <label class="block text-xs font-medium text-gray-600 mb-1">Delivery at (hour)</label>
                <input v-model.number="form.deliveryHour" type="number" min="0" max="23" class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
              </div>
            </div>
          </div>

          <div v-if="saveError" class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2">{{ saveError }}</div>
          <div v-if="saved" class="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl px-3 py-2">✓ Saved successfully</div>

          <button type="submit" :disabled="saving" class="w-full bg-brand-500 disabled:opacity-60 text-white rounded-xl py-3 font-semibold">
            {{ saving ? 'Saving…' : 'Save changes' }}
          </button>
        </form>

        <!-- Restaurant photos -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mt-5 space-y-5">
          <div>
            <h2 class="font-semibold text-gray-800">Restaurant photos</h2>
            <p class="text-xs text-gray-500 mt-0.5">
              Cover photo shows on the restaurant page. The logo appears on cards across the app.
            </p>
          </div>

          <!-- Cover -->
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-2">Cover photo</label>

            <div class="relative w-full aspect-[16/9] rounded-xl overflow-hidden bg-gray-100 border border-gray-200">
              <img
                v-if="restaurant.imageUrl"
                :src="restaurant.imageUrl"
                alt="Cover"
                class="w-full h-full object-cover"
              />
              <div v-else class="w-full h-full flex items-center justify-center text-4xl text-gray-300">🍽️</div>
            </div>

            <input
              ref="coverInputRef"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              class="hidden"
              @change="onCoverChosen"
            />

            <div class="mt-3 flex items-center gap-2">
              <button
                type="button"
                @click="pickCover"
                :disabled="coverUploading"
                class="bg-brand-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl px-4 py-2"
              >
                {{ coverUploading ? 'Uploading…' : restaurant.imageUrl ? 'Replace cover' : 'Upload cover' }}
              </button>
            </div>
            <p v-if="coverError" class="text-xs text-red-600 mt-2">⚠️ {{ coverError }}</p>
          </div>

          <!-- Logo -->
          <div class="border-t border-gray-100 pt-5">
            <label class="block text-sm font-medium text-gray-700 mb-2">Logo</label>

            <div class="flex items-center gap-4">
              <div class="w-20 h-20 rounded-xl overflow-hidden bg-gray-100 border border-gray-200 shrink-0">
                <img
                  v-if="restaurant.logoUrl"
                  :src="restaurant.logoUrl"
                  alt="Logo"
                  class="w-full h-full object-cover"
                />
                <div v-else class="w-full h-full flex items-center justify-center text-2xl text-gray-300">🏷️</div>
              </div>

              <input
                ref="logoInputRef"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                class="hidden"
                @change="onLogoChosen"
              />

              <button
                type="button"
                @click="pickLogo"
                :disabled="logoUploading"
                class="bg-brand-500 disabled:opacity-60 text-white text-sm font-semibold rounded-xl px-4 py-2"
              >
                {{ logoUploading ? 'Uploading…' : restaurant.logoUrl ? 'Replace logo' : 'Upload logo' }}
              </button>
            </div>
            <p v-if="logoError" class="text-xs text-red-600 mt-2">⚠️ {{ logoError }}</p>
          </div>
        </div>

        <!-- PromptPay QR onboarding -->
        <div class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mt-5">
          <div class="flex items-start justify-between mb-2">
            <div>
              <h2 class="font-semibold text-gray-800">PromptPay QR</h2>
              <p class="text-xs text-gray-500 mt-0.5">
                Customers scan this QR with their banking app to pay you directly.
              </p>
            </div>
            <span
              class="text-xs font-medium px-2.5 py-1 rounded-full shrink-0"
              :class="qrConfigured ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'"
            >
              {{ qrConfigured ? 'Configured' : 'Not set' }}
            </span>
          </div>

          <div v-if="!qrConfigured" class="mt-4 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-xl px-3 py-2">
            ⚠️ Customers can't place orders until you upload your PromptPay QR.
          </div>

          <div v-if="qrConfigured && qrImageUrl" class="mt-4 flex flex-col items-center bg-gray-50 rounded-xl p-4 border border-gray-100">
            <img :src="qrImageUrl" alt="Your PromptPay QR" class="w-40 h-40 rounded-lg" />
            <p class="text-xs text-gray-400 mt-2">Preview — customers see this on every order page.</p>
          </div>

          <div v-if="qrError" class="mt-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2">
            ⚠️ {{ qrError }}
          </div>

          <input
            ref="qrInputRef"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
            class="hidden"
            @change="onQrFileChosen"
          />

          <div class="mt-4 flex flex-col sm:flex-row gap-2">
            <button
              type="button"
              @click="pickQrFile"
              :disabled="qrUploading"
              class="flex-1 bg-brand-500 disabled:opacity-60 text-white rounded-xl py-2.5 font-semibold text-sm"
            >
              {{ qrUploading ? 'Reading QR…' : qrConfigured ? 'Replace QR' : 'Upload PromptPay QR' }}
            </button>
            <button
              v-if="qrConfigured"
              type="button"
              @click="requestRemoveQr"
              class="flex-1 sm:flex-none border border-red-200 text-red-600 rounded-xl px-4 py-2.5 font-medium text-sm hover:bg-red-50"
            >
              Remove
            </button>
          </div>

          <p class="text-xs text-gray-400 mt-3 leading-relaxed">
            Open your bank app → PromptPay → save your QR as an image, then upload it here. We
            extract just the PromptPay info and re-render a fresh QR for each order.
          </p>
        </div>
      </div>
    </div>

    <ConfirmModal
      :open="showRemoveQrModal"
      title="Remove your PromptPay QR?"
      message="Customers will not be able to place new orders until you upload a new one."
      confirm-label="Yes, remove QR"
      cancel-label="Keep QR"
      tone="danger"
      :loading="removingQr"
      :error-message="removeQrError"
      @confirm="confirmRemoveQr"
      @cancel="dismissRemoveQrModal"
    />
  </div>
</template>
