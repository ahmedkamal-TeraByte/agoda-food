<script setup lang="ts">
/**
 * Print-only receipt for an order. Hidden on screen (`hidden`), revealed only
 * when the page is being printed (`print:block`). The parent triggers
 * `window.print()` after this component is mounted; browsers handle the rest.
 *
 * The companion piece is `print:hidden` on the rest of the dashboard so the
 * print dialog only sees the receipt.
 *
 * Visual style is intentionally minimal monochrome — works on any office
 * printer and stays readable when stapled to a delivery bag.
 */
import type { Order } from '../data/types'

defineProps<{ order: Order }>()

function shortId(id: string): string {
  return id.slice(-6).toUpperCase()
}

function formatPlacedAt(iso: string): string {
  return new Date(iso).toLocaleString('en-GB', {
    timeZone: 'Asia/Bangkok',
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
</script>

<template>
  <div
    class="hidden print:block bg-white text-black px-6 py-8 max-w-md mx-auto font-sans text-[12pt] leading-snug"
  >
    <header class="text-center border-b-2 border-black pb-3 mb-4">
      <p class="text-[10pt] tracking-widest uppercase text-gray-600">Agoda Food</p>
      <h1 class="text-[16pt] font-bold mt-0.5">{{ order.restaurantName }}</h1>
    </header>

    <section class="mb-4">
      <p class="text-[14pt] font-bold">Order #{{ shortId(order.id) }}</p>
      <p class="text-[10pt] text-gray-600">Placed {{ formatPlacedAt(order.createdAt) }}</p>
    </section>

    <section class="border-t border-b border-black border-dashed py-3 mb-4">
      <p class="text-[10pt] uppercase tracking-wide text-gray-600 mb-1">Deliver to</p>
      <p class="font-semibold">{{ order.customer?.displayName ?? '—' }}</p>
      <p v-if="order.customer?.phone" class="text-[11pt]">{{ order.customer.phone }}</p>
      <p v-else class="text-[11pt] italic text-gray-500">No phone on file</p>
    </section>

    <section class="mb-4">
      <p class="text-[10pt] uppercase tracking-wide text-gray-600 mb-2">Items</p>
      <table class="w-full">
        <tbody>
          <tr v-for="item in order.items" :key="item.menuItemId" class="align-top">
            <td class="py-1 pr-2 w-8 font-semibold tabular-nums">{{ item.quantity }}×</td>
            <td class="py-1">
              <span class="font-medium">{{ item.name }}</span>
              <p
                v-if="item.note"
                class="text-[10pt] mt-0.5 italic border-l-2 border-black pl-2"
              >
                Note: {{ item.note }}
              </p>
            </td>
            <td class="py-1 pl-2 text-right tabular-nums whitespace-nowrap">
              ฿{{ item.price * item.quantity }}
            </td>
          </tr>
        </tbody>
      </table>
    </section>

    <section class="border-t border-black pt-3 space-y-1 text-[11pt] tabular-nums">
      <div class="flex justify-between">
        <span>Subtotal</span><span>฿{{ order.subtotal }}</span>
      </div>
      <div class="flex justify-between">
        <span>Delivery</span>
        <span>{{ order.deliveryFee === 0 ? 'Free' : `฿${order.deliveryFee}` }}</span>
      </div>
      <div class="flex justify-between border-t border-black pt-1.5 mt-1.5 text-[14pt] font-bold">
        <span>Total</span><span>฿{{ order.total }}</span>
      </div>
    </section>

    <footer class="text-center text-[9pt] text-gray-500 mt-6">
      Thank you — Agoda Food
    </footer>
  </div>
</template>
