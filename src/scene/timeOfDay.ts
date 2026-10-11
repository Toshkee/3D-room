import { useEffect, useState } from 'react'
import { clamp } from '../util'

// Real local time of day → sky + sunlight parameters for the window, the sun
// patch on the floor and a gentle warm tint on the key light. `?hour=17.5` in
// the URL overrides the clock (handy for previewing the golden hour).

export interface DayLight {
  /** Fractional local hour, 0..24. */
  hour: number
  /** 0 at night → 1 in full daylight (smooth across dawn/dusk). */
  day: number
  /** 0..1 strength of golden-hour warmth (morning + evening). */
  golden: number
  /** Sun elevation, radians (only meaningful when day > 0). */
  sunAlt: number
  /** Sun direction across the window: -1 (morning, left) … +1 (evening, right). */
  sunSide: number
}

function readOverride(): number | null {
  if (typeof location === 'undefined') return null
  const v = new URLSearchParams(location.search).get('hour')
  if (v == null) return null
  const n = Number(v)
  return Number.isFinite(n) ? ((n % 24) + 24) % 24 : null
}

const smooth = (e0: number, e1: number, x: number) => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1)
  return t * t * (3 - 2 * t)
}

export function dayLightAt(hour: number): DayLight {
  // Sunrise ~6:30, sunset ~19:30 — a pleasant, latitude-agnostic default.
  const day = smooth(5.8, 7.4, hour) * (1 - smooth(18.8, 20.4, hour))
  const golden = Math.max(
    smooth(6.0, 7.0, hour) * (1 - smooth(7.5, 9.2, hour)),
    smooth(16.3, 18.2, hour) * (1 - smooth(19.6, 20.6, hour)),
  )
  const noonness = 1 - Math.abs(hour - 13) / 6.5 // 1 at 13:00, 0 at 6:30/19:30
  const sunAlt = clamp(0.18 + Math.max(0, noonness) * 0.95, 0.18, 1.13)
  const sunSide = clamp((hour - 13) / 6.5, -1, 1)
  return { hour, day, golden, sunAlt, sunSide }
}

function nowHour(): number {
  const o = readOverride()
  if (o != null) return o
  const d = new Date()
  return d.getHours() + d.getMinutes() / 60
}

/** Re-evaluated once a minute — the sky changes slowly. */
export function useDayLight(): DayLight {
  const [light, setLight] = useState(() => dayLightAt(nowHour()))
  useEffect(() => {
    const id = setInterval(() => setLight(dayLightAt(nowHour())), 60_000)
    return () => clearInterval(id)
  }, [])
  return light
}
