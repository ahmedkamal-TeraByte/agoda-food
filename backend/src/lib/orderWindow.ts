const TZ = 'Asia/Bangkok'

export interface OrderWindowConfig {
  openHour: number   // hour ordering becomes available (0-23)
  closeHour: number  // hour ordering closes (0-23)
  deliveryHour: number // hour food is delivered (0-23)
}

function getBangkokParts(date: Date): { hour: number; year: number; month: number; day: number } {
  const fmt = new Intl.DateTimeFormat('en', {
    timeZone: TZ,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  })
  const parts = fmt.formatToParts(date)
  const get = (type: string) => parseInt(parts.find((p) => p.type === type)!.value)
  return { year: get('year'), month: get('month'), day: get('day'), hour: get('hour') }
}

/**
 * Returns the service Date for an order placed at `now`, or null if ordering
 * is currently closed.
 *
 * When openHour > closeHour the window wraps midnight:
 *   e.g. openHour=17, closeHour=10 → open 17:00–10:00 the next morning.
 *   - Order at 18:00 Mon → service Tuesday at deliveryHour
 *   - Order at 09:00 Tue → service Tuesday at deliveryHour
 */
export function getServiceDate(window: OrderWindowConfig, now: Date = new Date()): Date | null {
  const { hour, year, month, day } = getBangkokParts(now)
  const { openHour, closeHour, deliveryHour } = window

  let isOpen: boolean
  let daysAhead = 0

  if (openHour > closeHour) {
    // Window wraps midnight
    if (hour >= openHour) {
      isOpen = true
      daysAhead = 1 // delivery is the next calendar day
    } else if (hour < closeHour) {
      isOpen = true
      daysAhead = 0 // delivery is today
    } else {
      isOpen = false
    }
  } else {
    isOpen = hour >= openHour && hour < closeHour
    daysAhead = 0
  }

  if (!isOpen) return null

  // Compute the target calendar day
  const base = new Date(Date.UTC(year, month - 1, day))
  base.setUTCDate(base.getUTCDate() + daysAhead)
  const sy = base.getUTCFullYear()
  const sm = String(base.getUTCMonth() + 1).padStart(2, '0')
  const sd = String(base.getUTCDate()).padStart(2, '0')
  const sh = String(deliveryHour).padStart(2, '0')

  // Bangkok is UTC+7
  return new Date(`${sy}-${sm}-${sd}T${sh}:00:00+07:00`)
}

/**
 * Returns a human-readable status label for use in the UI banner.
 */
export function getWindowStatus(
  window: OrderWindowConfig,
  now: Date = new Date(),
): { isOpen: boolean; label: string } {
  const { hour, day: _day, month: _month, year: _year } = getBangkokParts(now)
  const mins = now.getMinutes()
  const { openHour, closeHour } = window

  let isOpen: boolean
  let minutesUntil: number

  if (openHour > closeHour) {
    if (hour >= openHour) {
      isOpen = true
      minutesUntil = (24 - hour + closeHour) * 60 - mins
    } else if (hour < closeHour) {
      isOpen = true
      minutesUntil = (closeHour - hour) * 60 - mins
    } else {
      isOpen = false
      minutesUntil = (openHour - hour) * 60 - mins
    }
  } else {
    isOpen = hour >= openHour && hour < closeHour
    minutesUntil = isOpen ? (closeHour - hour) * 60 - mins : (openHour - hour + 24) * 60 % (24 * 60) - mins
    if (minutesUntil <= 0) minutesUntil += 24 * 60
  }

  const h = Math.floor(Math.abs(minutesUntil) / 60)
  const m = Math.abs(minutesUntil) % 60
  const timeLabel = h > 0 ? `${h}h ${m}m` : `${m}m`

  return {
    isOpen,
    label: isOpen ? `Closes in ${timeLabel}` : `Opens in ${timeLabel}`,
  }
}
