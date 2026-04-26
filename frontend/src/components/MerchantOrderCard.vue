<script setup lang="ts">
import type { Order } from '../data/types'

defineProps<{
  order: Order
  updatingId?: string | null
}>()

defineEmits<{
  (e: 'review', order: Order): void
  (e: 'advance', order: Order): void
  (e: 'print', order: Order): void
}>()

const STATUS_LABELS: Record<string, string> = {
  awaiting_payment: 'Awaiting payment',
  pending_verification: 'Verify payment',
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
}

const STATUS_COLORS: Record<string, string> = {
  awaiting_payment: 'bg-amber-100 text-amber-700',
  pending_verification: 'bg-yellow-100 text-yellow-700 ring-1 ring-yellow-300',
  pending: 'bg-blue-100 text-blue-700',
  confirmed: 'bg-brand-100 text-brand-700',
  preparing: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
}

const PAYMENT_LABELS: Record<string, string> = {
  unpaid: 'Unpaid',
  paid: 'Paid',
  refunded: 'Refunded',
}

const PAYMENT_COLORS: Record<string, string> = {
  unpaid: 'bg-gray-100 text-gray-600',
  paid: 'bg-green-100 text-green-700',
  refunded: 'bg-orange-100 text-orange-700',
}

const NEXT_STATUS: Record<string, string> = {
  confirmed: 'preparing',
  preparing: 'delivered',
}

function customerInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('')
}
</script>

<template>
  <div>
    <div class="flex items-start justify-between mb-3">
      <div>
        <p class="font-semibold text-gray-900 text-sm">Order #{{ order.id.slice(-6).toUpperCase() }}</p>
        <p class="text-xs text-gray-400 mt-0.5">
          Placed
          {{ new Date(order.createdAt).toLocaleTimeString('en-GB', { timeZone: 'Asia/Bangkok', hour: '2-digit', minute: '2-digit' }) }}
        </p>
      </div>
      <div class="flex flex-col items-end gap-1.5">
        <span class="text-xs font-medium px-2.5 py-1 rounded-full" :class="STATUS_COLORS[order.status]">
          {{ STATUS_LABELS[order.status] }}
        </span>
        <span
          v-if="order.paymentStatus"
          class="text-[10px] font-medium px-2 py-0.5 rounded-full"
          :class="PAYMENT_COLORS[order.paymentStatus]"
        >
          {{ PAYMENT_LABELS[order.paymentStatus] }}
        </span>
      </div>
    </div>

    <div
      v-if="order.customer"
      class="flex items-center gap-3 mb-3 p-2.5 bg-gray-50 rounded-xl"
    >
      <img
        v-if="order.customer.pictureUrl"
        :src="order.customer.pictureUrl"
        :alt="order.customer.displayName"
        class="w-9 h-9 rounded-full object-cover shrink-0"
      />
      <div
        v-else
        class="w-9 h-9 rounded-full bg-brand-100 text-brand-700 flex items-center justify-center text-xs font-semibold shrink-0"
      >
        {{ customerInitials(order.customer.displayName) }}
      </div>
      <div class="min-w-0 flex-1">
        <p class="text-sm font-medium text-gray-900 truncate">{{ order.customer.displayName }}</p>
        <p class="text-xs text-gray-500 truncate">
          <a v-if="order.customer.phone" :href="`tel:${order.customer.phone}`" class="hover:underline">
            {{ order.customer.phone }}
          </a>
          <span v-if="order.customer.phone && order.customer.email" class="mx-1.5 text-gray-300">·</span>
          <a v-if="order.customer.email" :href="`mailto:${order.customer.email}`" class="hover:underline">
            {{ order.customer.email }}
          </a>
        </p>
      </div>
    </div>

    <div class="space-y-2 mb-3">
      <div
        v-for="item in order.items"
        :key="item.menuItemId"
        class="text-sm"
      >
        <div class="flex justify-between gap-2">
          <span class="text-gray-700">{{ item.name }} × {{ item.quantity }}</span>
          <span class="text-gray-500 shrink-0">฿{{ item.price * item.quantity }}</span>
        </div>
        <p
          v-if="item.note"
          class="text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-lg px-2 py-1 mt-1"
        >
          <span class="font-semibold">Note:</span> {{ item.note }}
        </p>
      </div>
    </div>

    <div class="flex items-center justify-between border-t border-gray-100 pt-3 gap-2">
      <span class="font-bold text-gray-900 shrink-0">฿{{ order.total }}</span>

      <div class="flex gap-2 flex-wrap justify-end">
        <button
          v-if="order.status === 'pending_verification'"
          @click="$emit('review', order)"
          class="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-1.5 rounded-xl text-xs font-semibold"
        >
          Review payment
        </button>

        <template v-else-if="order.status === 'preparing'">
          <button
            @click="$emit('print', order)"
            class="border border-gray-200 hover:bg-gray-50 text-gray-700 px-3 py-1.5 rounded-xl text-xs font-semibold inline-flex items-center gap-1"
          >
            <span aria-hidden="true">🖨</span>
            <span>Print receipt</span>
          </button>
          <button
            @click="$emit('advance', order)"
            :disabled="updatingId === order.id"
            class="bg-brand-500 disabled:opacity-60 text-white px-4 py-1.5 rounded-xl text-xs font-semibold"
          >
            {{ updatingId === order.id ? 'Updating…' : 'Mark delivered' }}
          </button>
        </template>

        <button
          v-else-if="NEXT_STATUS[order.status]"
          @click="$emit('advance', order)"
          :disabled="updatingId === order.id"
          class="bg-brand-500 disabled:opacity-60 text-white px-4 py-1.5 rounded-xl text-xs font-semibold"
        >
          <span v-if="updatingId === order.id">Updating…</span>
          <span v-else-if="order.status === 'confirmed'">Start preparing</span>
        </button>
      </div>
    </div>
  </div>
</template>
