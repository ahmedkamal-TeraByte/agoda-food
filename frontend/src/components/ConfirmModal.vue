<script setup lang="ts">
/**
 * Reusable confirmation modal — replaces native `confirm()` / `alert()`.
 *
 * Designed to mirror the cancel-order modal in OrderSuccessPage so the visual
 * language is consistent. Callers control async state via `loading` and surface
 * inline errors through `errorMessage` (so the user can retry without losing
 * the modal). Use the default slot for richer message bodies.
 *
 * Backdrop / cancel button are disabled while `loading` to avoid race
 * conditions where the user dismisses an in-flight request.
 */
withDefaults(
  defineProps<{
    open: boolean
    title: string
    message?: string
    confirmLabel?: string
    cancelLabel?: string
    tone?: 'danger' | 'warn' | 'brand'
    loading?: boolean
    errorMessage?: string | null
  }>(),
  {
    confirmLabel: 'Confirm',
    cancelLabel: 'Cancel',
    tone: 'danger',
    loading: false,
    errorMessage: null,
  },
)

defineEmits<{
  (e: 'confirm'): void
  (e: 'cancel'): void
}>()

const TONE = {
  danger: { iconBg: 'bg-red-50', icon: '⚠️', btn: 'bg-red-600 hover:bg-red-700' },
  warn: { iconBg: 'bg-amber-50', icon: '⚠️', btn: 'bg-amber-600 hover:bg-amber-700' },
  brand: { iconBg: 'bg-brand-50', icon: '✨', btn: 'bg-brand-500 hover:bg-brand-600' },
} as const
</script>

<template>
  <Transition
    enter-active-class="transition-opacity duration-150"
    leave-active-class="transition-opacity duration-150"
    enter-from-class="opacity-0"
    leave-to-class="opacity-0"
  >
    <div
      v-if="open"
      class="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4"
      @click.self="!loading && $emit('cancel')"
    >
      <div
        class="w-full sm:max-w-sm bg-white rounded-t-3xl sm:rounded-3xl shadow-xl px-6 pt-6 pb-5"
        role="dialog"
        aria-modal="true"
      >
        <div class="flex flex-col items-center text-center">
          <div
            class="w-14 h-14 rounded-full flex items-center justify-center text-3xl mb-3"
            :class="TONE[tone].iconBg"
          >
            {{ TONE[tone].icon }}
          </div>
          <h2 class="text-lg font-bold text-gray-900 mb-1">{{ title }}</h2>
          <slot>
            <p v-if="message" class="text-sm text-gray-500 whitespace-pre-line">{{ message }}</p>
          </slot>
        </div>

        <div
          v-if="errorMessage"
          class="mt-4 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl px-3 py-2"
        >
          ⚠️ {{ errorMessage }}
        </div>

        <div class="mt-5 flex flex-col-reverse sm:flex-row gap-2">
          <button
            type="button"
            @click="$emit('cancel')"
            :disabled="loading"
            class="flex-1 border border-gray-200 text-gray-700 disabled:opacity-60 rounded-xl py-3 font-medium text-sm hover:bg-gray-50"
          >
            {{ cancelLabel }}
          </button>
          <button
            type="button"
            @click="$emit('confirm')"
            :disabled="loading"
            :class="[
              'flex-1 disabled:opacity-60 text-white rounded-xl py-3 font-semibold text-sm',
              TONE[tone].btn,
            ]"
          >
            {{ loading ? 'Working…' : confirmLabel }}
          </button>
        </div>
      </div>
    </div>
  </Transition>
</template>
