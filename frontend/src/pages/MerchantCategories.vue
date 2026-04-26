<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import AppHeader from '../components/AppHeader.vue'
import MerchantTabs from '../components/MerchantTabs.vue'
import ConfirmModal from '../components/ConfirmModal.vue'
import {
  fetchMerchantCategories,
  createMerchantCategory,
  renameMerchantCategory,
  deleteMerchantCategory,
} from '../services/api'

const categories = ref<string[]>([])
const loading = ref(true)
const error = ref<string | null>(null)

const newName = ref('')
const adding = ref(false)
const addError = ref<string | null>(null)

const editingName = ref<string | null>(null)
const editValue = ref('')
const savingEdit = ref(false)
const editError = ref<string | null>(null)

const deletingName = ref<string | null>(null)
const pendingDelete = ref<string | null>(null)
const deleteError = ref<string | null>(null)
const deleteTitle = computed(() =>
  pendingDelete.value ? `Delete category "${pendingDelete.value}"?` : 'Delete category?',
)

onMounted(loadCategories)

async function loadCategories() {
  loading.value = true
  error.value = null
  try {
    categories.value = await fetchMerchantCategories()
  } catch (e) {
    error.value = e instanceof Error ? e.message : 'Failed to load categories'
  } finally {
    loading.value = false
  }
}

async function addCategory() {
  const name = newName.value.trim()
  if (!name) return
  adding.value = true
  addError.value = null
  try {
    categories.value = await createMerchantCategory(name)
    newName.value = ''
  } catch (e) {
    addError.value = e instanceof Error ? e.message : 'Failed to add category'
  } finally {
    adding.value = false
  }
}

function startEdit(name: string) {
  editingName.value = name
  editValue.value = name
  editError.value = null
}

function cancelEdit() {
  editingName.value = null
  editValue.value = ''
  editError.value = null
}

async function saveEdit() {
  if (!editingName.value) return
  const newValue = editValue.value.trim()
  if (!newValue || newValue === editingName.value) {
    cancelEdit()
    return
  }
  savingEdit.value = true
  editError.value = null
  try {
    categories.value = await renameMerchantCategory(editingName.value, newValue)
    cancelEdit()
  } catch (e) {
    editError.value = e instanceof Error ? e.message : 'Failed to rename'
  } finally {
    savingEdit.value = false
  }
}

function requestDelete(name: string) {
  deleteError.value = null
  pendingDelete.value = name
}

function dismissDelete() {
  if (deletingName.value) return
  pendingDelete.value = null
  deleteError.value = null
}

async function confirmDelete() {
  const name = pendingDelete.value
  if (!name) return
  deletingName.value = name
  deleteError.value = null
  try {
    categories.value = await deleteMerchantCategory(name)
    pendingDelete.value = null
  } catch (e) {
    deleteError.value = e instanceof Error ? e.message : 'Failed to delete category'
  } finally {
    deletingName.value = null
  }
}
</script>

<template>
  <div class="min-h-screen bg-gray-50">
    <AppHeader />

    <div class="max-w-2xl mx-auto px-4 py-6">
      <MerchantTabs />

      <div class="mb-5">
        <h1 class="font-bold text-gray-900 text-lg">Categories</h1>
        <p class="text-xs text-gray-400 mt-0.5">
          Group dishes on your menu. Adding a dish lets you pick from these.
        </p>
      </div>

      <!-- Add new -->
      <form @submit.prevent="addCategory" class="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <label class="block text-sm font-medium text-gray-700 mb-1.5">Add a category</label>
        <div class="flex gap-2">
          <input
            v-model="newName"
            type="text"
            placeholder="e.g. Salads, Mains, Drinks"
            maxlength="40"
            class="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
          />
          <button
            type="submit"
            :disabled="adding || !newName.trim()"
            class="bg-brand-500 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold"
          >
            {{ adding ? 'Adding…' : 'Add' }}
          </button>
        </div>
        <div v-if="addError" class="mt-2 text-xs text-red-600">{{ addError }}</div>
      </form>

      <!-- Loading -->
      <div v-if="loading" class="space-y-2">
        <div v-for="n in 3" :key="n" class="h-12 bg-white rounded-xl animate-pulse border border-gray-100" />
      </div>

      <!-- Error -->
      <div v-else-if="error" class="text-red-600 text-sm">{{ error }}</div>

      <!-- Empty -->
      <div v-else-if="categories.length === 0" class="text-center py-16 text-gray-400">
        <div class="text-4xl mb-2">🏷️</div>
        <p class="text-sm">No categories yet. Add your first one above.</p>
      </div>

      <!-- List -->
      <ul v-else class="space-y-2">
        <li
          v-for="name in categories"
          :key="name"
          class="bg-white rounded-xl border border-gray-100 shadow-sm px-4 py-3 flex items-center gap-3"
        >
          <template v-if="editingName === name">
            <input
              v-model="editValue"
              type="text"
              maxlength="40"
              @keyup.enter="saveEdit"
              @keyup.escape="cancelEdit"
              class="flex-1 border border-brand-300 rounded-xl px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-300"
            />
            <button
              @click="saveEdit"
              :disabled="savingEdit"
              class="text-brand-600 text-sm font-semibold disabled:opacity-60"
            >
              {{ savingEdit ? 'Saving…' : 'Save' }}
            </button>
            <button @click="cancelEdit" class="text-gray-400 text-sm">Cancel</button>
          </template>
          <template v-else>
            <span class="flex-1 text-sm font-medium text-gray-800">{{ name }}</span>
            <button @click="startEdit(name)" class="text-brand-500 text-xs font-medium hover:underline">
              Rename
            </button>
            <button
              @click="requestDelete(name)"
              :disabled="deletingName === name"
              class="text-red-500 text-xs font-medium hover:underline disabled:opacity-60"
            >
              {{ deletingName === name ? 'Deleting…' : 'Delete' }}
            </button>
          </template>
        </li>
        <li v-if="editingName && editError" class="text-xs text-red-600 px-2">{{ editError }}</li>
      </ul>
    </div>

    <ConfirmModal
      :open="pendingDelete !== null"
      :title="deleteTitle"
      message="Dishes using this category will be left uncategorized — they'll still appear on your menu."
      confirm-label="Yes, delete"
      cancel-label="Keep it"
      tone="danger"
      :loading="deletingName !== null"
      :error-message="deleteError"
      @confirm="confirmDelete"
      @cancel="dismissDelete"
    />
  </div>
</template>
