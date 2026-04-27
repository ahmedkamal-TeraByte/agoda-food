<script setup lang="ts">
import { ref, computed, onMounted, reactive } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import MerchantTabs from '../components/MerchantTabs.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import {
  fetchMerchantMenuItems,
  fetchMerchantCategories,
  createMerchantMenuItem,
  updateMerchantMenuItem,
  deleteMerchantMenuItem,
  uploadMerchantImage,
} from '../services/api'
import type { MenuItem } from '../data/types'

const menuItems = ref<MenuItem[]>([])
const categories = ref<string[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

type Mode = 'list' | 'add' | 'edit'
const mode = ref<Mode>('list')
const editingMenuItem = ref<MenuItem | null>(null)

const form = reactive({
  name: '',
  description: '',
  price: 0,
  imageKey: '',
  imageUrl: '',   // preview-only, not sent to the API
  category: '',
  isAvailable: true,
})
const formError = ref<string | null>(null)
const saving = ref(false)
const photoUploading = ref(false)
const photoError = ref<string | null>(null)
const photoInputRef = ref<HTMLInputElement | null>(null)

const pendingDelete = ref<MenuItem | null>(null)
const deleting = ref(false)
const deleteError = ref<string | null>(null)
const deleteTitle = computed(() =>
  pendingDelete.value ? `Delete "${pendingDelete.value.name}"?` : 'Delete dish?',
)

onMounted(async () => {
  await Promise.all([loadMenuItems(), loadCategories()])
})

async function loadMenuItems() {
  loading.value = true
  try {
    menuItems.value = await fetchMerchantMenuItems()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load menu items'
  } finally {
    loading.value = false
  }
}

async function loadCategories() {
  try {
    categories.value = await fetchMerchantCategories()
  } catch {
    categories.value = []
  }
}

function openAdd() {
  Object.assign(form, { name: '', description: '', price: 0, imageKey: '', imageUrl: '', category: '', isAvailable: true })
  editingMenuItem.value = null
  formError.value = null
  photoError.value = null
  mode.value = 'add'
}

function openEdit(menuItem: MenuItem) {
  Object.assign(form, {
    name: menuItem.name,
    description: menuItem.description,
    price: menuItem.price,
    imageKey: menuItem.imageKey ?? '',
    imageUrl: menuItem.imageUrl ?? '',
    category: menuItem.category ?? '',
    isAvailable: menuItem.isAvailable ?? true,
  })
  editingMenuItem.value = menuItem
  formError.value = null
  photoError.value = null
  mode.value = 'edit'
}

function pickPhoto() {
  photoInputRef.value?.click()
}

async function onPhotoChosen(event: Event) {
  const input = event.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  photoError.value = null
  photoUploading.value = true
  try {
    const { imageUrl, fileKey } = await uploadMerchantImage(file, 'menu-item')
    form.imageKey = fileKey
    form.imageUrl = imageUrl
  } catch (e) {
    photoError.value = e instanceof Error ? e.message : 'Failed to upload photo'
  } finally {
    photoUploading.value = false
    input.value = ''
  }
}

function removePhoto() {
  form.imageKey = ''
  form.imageUrl = ''
  photoError.value = null
}

async function saveForm() {
  if (!form.name.trim() || !form.description.trim()) {
    formError.value = 'Name and description are required'
    return
  }
  saving.value = true
  formError.value = null
  try {
    const payload = {
      name: form.name,
      description: form.description,
      price: form.price,
      imageKey: form.imageKey || undefined,
      category: form.category || '',
      isAvailable: form.isAvailable,
    }
    if (mode.value === 'add') {
      await createMerchantMenuItem(payload)
    } else if (editingMenuItem.value) {
      await updateMerchantMenuItem(editingMenuItem.value.id, payload)
    }
    await loadMenuItems()
    mode.value = 'list'
  } catch (e) {
    formError.value = e instanceof Error ? e.message : 'Failed to save'
  } finally {
    saving.value = false
  }
}

function requestDelete(menuItem: MenuItem) {
  deleteError.value = null
  pendingDelete.value = menuItem
}

function dismissDelete() {
  if (deleting.value) return
  pendingDelete.value = null
  deleteError.value = null
}

async function confirmDelete() {
  const target = pendingDelete.value
  if (!target) return
  deleting.value = true
  deleteError.value = null
  try {
    await deleteMerchantMenuItem(target.id)
    await loadMenuItems()
    pendingDelete.value = null
  } catch (e) {
    deleteError.value = e instanceof Error ? e.message : 'Failed to delete'
  } finally {
    deleting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <AppHeader />

    <div class="max-w-2xl mx-auto px-4 py-6">
      <MerchantTabs />

      <!-- Form (add / edit) -->
      <div v-if="mode !== 'list'">
        <div class="flex items-center gap-3 mb-5">
          <button @click="mode = 'list'" class="text-brand-500 text-sm">← Back</button>
          <h1 class="font-bold text-gray-900 text-lg">{{ mode === 'add' ? 'Add dish' : 'Edit dish' }}</h1>
        </div>

        <form @submit.prevent="saveForm" class="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Name *</label>
            <input v-model="form.name" type="text" required class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Description *</label>
            <textarea v-model="form.description" rows="2" required class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300 resize-none" />
          </div>
          <div class="grid grid-cols-2 gap-3">
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Price (฿) *</label>
              <input v-model.number="form.price" type="number" min="0" required class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300" />
            </div>
            <div>
              <label class="block text-sm font-medium text-gray-700 mb-1.5">Category</label>
              <select
                v-model="form.category"
                class="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-brand-300"
              >
                <option value="">— None —</option>
                <option v-for="c in categories" :key="c" :value="c">{{ c }}</option>
              </select>
              <p v-if="categories.length === 0" class="text-xs text-gray-400 mt-1">
                No categories yet. Add some on the Categories tab.
              </p>
            </div>
          </div>
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1.5">Photo (optional)</label>

            <input
              ref="photoInputRef"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
              class="hidden"
              @change="onPhotoChosen"
            />

            <div class="flex items-center gap-3">
              <div class="w-20 h-20 rounded-xl bg-gray-100 border border-gray-200 shrink-0 flex items-center justify-center overflow-hidden">
                <img v-if="form.imageUrl" :src="form.imageUrl" alt="Dish photo" class="w-full h-full object-cover" />
                <span v-else class="text-2xl text-gray-300">🍽️</span>
              </div>

              <div class="flex flex-col gap-1.5">
                <button
                  type="button"
                  @click="pickPhoto"
                  :disabled="photoUploading"
                  class="bg-brand-500 disabled:opacity-60 text-white text-xs font-semibold rounded-lg px-3 py-1.5"
                >
                  {{ photoUploading ? 'Uploading…' : form.imageUrl ? 'Replace photo' : 'Upload photo' }}
                </button>
                <button
                  v-if="form.imageUrl"
                  type="button"
                  @click="removePhoto"
                  class="text-xs text-red-500 font-medium hover:underline text-left"
                >
                  Remove
                </button>
              </div>
            </div>

            <p v-if="photoError" class="text-xs text-red-600 mt-2">⚠️ {{ photoError }}</p>
            <p v-else class="text-xs text-gray-400 mt-2">JPEG, PNG, WebP or HEIC. We resize and re-encode for you.</p>
          </div>
          <div class="flex items-center justify-between py-2">
            <span class="text-sm font-medium text-gray-700">Available to order</span>
            <button type="button" @click="form.isAvailable = !form.isAvailable"
              class="relative inline-flex h-6 w-11 rounded-full transition-colors"
              :class="form.isAvailable ? 'bg-brand-500' : 'bg-gray-200'">
              <span class="inline-block w-5 h-5 rounded-full bg-white shadow transform transition-transform mt-0.5"
                :class="form.isAvailable ? 'translate-x-5' : 'translate-x-1'" />
            </button>
          </div>
          <div v-if="formError" class="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-3 py-2">{{ formError }}</div>
          <button type="submit" :disabled="saving" class="w-full bg-brand-500 disabled:opacity-60 text-white rounded-xl py-3 font-semibold">
            {{ saving ? 'Saving…' : 'Save dish' }}
          </button>
        </form>
      </div>

      <!-- Dish list -->
      <div v-else>
        <div class="flex items-center justify-between mb-5">
          <h1 class="font-bold text-gray-900 text-lg">Menu</h1>
          <button @click="openAdd" class="bg-brand-500 text-white px-4 py-2 rounded-xl text-sm font-semibold">
            + Add dish
          </button>
        </div>

        <div v-if="loading" class="space-y-3">
          <div v-for="n in 4" :key="n" class="h-20 bg-white rounded-2xl animate-pulse border border-gray-100" />
        </div>

        <div v-else-if="error" class="text-red-600 text-sm">{{ error }}</div>

        <div v-else-if="menuItems.length === 0" class="text-center py-20 text-gray-400">
          <div class="text-5xl mb-3">🍽️</div>
          <p>No menu items yet. Add your first one!</p>
        </div>

        <div v-else class="space-y-3">
          <div
            v-for="menuItem in menuItems"
            :key="menuItem.id"
            class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3"
          >
            <img v-if="menuItem.imageUrl" :src="menuItem.imageUrl" :alt="menuItem.name" class="w-14 h-14 rounded-xl object-cover shrink-0" />
            <div v-else class="w-14 h-14 rounded-xl bg-gray-100 shrink-0 flex items-center justify-center text-2xl">🍽️</div>

            <div class="flex-1 min-w-0">
              <p class="font-semibold text-gray-900 text-sm">{{ menuItem.name }}</p>
              <p class="text-xs text-gray-400">
                {{ menuItem.category || 'Uncategorized' }} · ฿{{ menuItem.price }}
              </p>
              <span
                class="text-xs px-2 py-0.5 rounded-full font-medium"
                :class="menuItem.isAvailable ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'"
              >
                {{ menuItem.isAvailable ? 'Available' : 'Unavailable' }}
              </span>
            </div>

            <div class="flex flex-col gap-1.5 shrink-0">
              <button @click="openEdit(menuItem)" class="text-brand-500 text-xs font-medium hover:underline">Edit</button>
              <button @click="requestDelete(menuItem)" class="text-red-500 text-xs font-medium hover:underline">Delete</button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <ConfirmModal
      :open="pendingDelete !== null"
      :title="deleteTitle"
      message="This dish will be removed from your menu. Past orders that include it are unaffected."
      confirm-label="Yes, delete"
      cancel-label="Keep it"
      tone="danger"
      :loading="deleting"
      :error-message="deleteError"
      @confirm="confirmDelete"
      @cancel="dismissDelete"
    />
  </div>
</template>
