<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const tabs = [
  { label: 'Orders', path: '/merchant/orders' },
  { label: 'Menu', path: '/merchant/menu' },
  { label: 'Categories', path: '/merchant/categories' },
  { label: 'Settings', path: '/merchant/settings' },
] as const

function isActive(path: string) {
  return route.path === path
}
</script>

<template>
  <div class="flex gap-2 mb-6 border-b border-gray-200">
    <button
      v-for="tab in tabs"
      :key="tab.path"
      @click="router.push(tab.path)"
      class="pb-2 px-1 text-sm transition-colors"
      :class="
        isActive(tab.path)
          ? 'font-semibold text-brand-500 border-b-2 border-brand-500'
          : 'text-gray-500 hover:text-gray-700'
      "
    >
      {{ tab.label }}
    </button>
  </div>
</template>
