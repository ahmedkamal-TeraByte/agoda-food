import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { OrderWindow } from '../data/types'

const TZ = 'Asia/Bangkok'

function getBangkokHour(date: Date): number {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: TZ,
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date)
  return parseInt(parts.find((p) => p.type === 'hour')!.value)
}

function isWindowOpen(ow: OrderWindow, hour: number): boolean {
  const { openHour, closeHour } = ow
  if (openHour > closeHour) {
    return hour >= openHour || hour < closeHour
  }
  return hour >= openHour && hour < closeHour
}

function minutesUntilNext(ow: OrderWindow, hour: number, nowMinutes: number): number {
  const { openHour, closeHour } = ow
  const open = isWindowOpen(ow, hour)

  if (open) {
    // Minutes until close
    if (ow.openHour > ow.closeHour && hour >= ow.openHour) {
      return (24 - hour + closeHour) * 60 - nowMinutes
    }
    return (closeHour - hour) * 60 - nowMinutes
  } else {
    // Minutes until open
    if (hour < openHour) {
      return (openHour - hour) * 60 - nowMinutes
    }
    return (24 - hour + openHour) * 60 - nowMinutes
  }
}

function fmtMinutes(mins: number): string {
  const h = Math.floor(Math.abs(mins) / 60)
  const m = Math.abs(mins) % 60
  if (h > 0 && m > 0) return `${h}h ${m}m`
  if (h > 0) return `${h}h`
  return `${m}m`
}

/**
 * Reactive composable that tracks whether a restaurant's order window is open
 * and provides a human-readable label. Updates every minute.
 */
export function useOrderWindow(orderWindow: OrderWindow | undefined) {
  const now = ref(new Date())
  let timer: ReturnType<typeof setInterval> | null = null

  onMounted(() => {
    timer = setInterval(() => {
      now.value = new Date()
    }, 60_000)
  })

  onUnmounted(() => {
    if (timer) clearInterval(timer)
  })

  const isOpen = computed(() => {
    if (!orderWindow) return true
    const hour = getBangkokHour(now.value)
    return isWindowOpen(orderWindow, hour)
  })

  const label = computed(() => {
    if (!orderWindow) return ''
    const hour = getBangkokHour(now.value)
    const mins = minutesUntilNext(orderWindow, hour, now.value.getMinutes())
    const open = isWindowOpen(orderWindow, hour)
    return open ? `Closes in ${fmtMinutes(mins)}` : `Opens in ${fmtMinutes(mins)}`
  })

  const deliveryTimeLabel = computed(() => {
    if (!orderWindow) return ''
    const h = orderWindow.deliveryHour
    const period = h >= 12 ? 'PM' : 'AM'
    const display = h > 12 ? h - 12 : h === 0 ? 12 : h
    return `${display}:00 ${period}`
  })

  return { isOpen, label, deliveryTimeLabel }
}
