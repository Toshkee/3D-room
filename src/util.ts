export function fmtTime(at: number): string {
  return new Date(at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

/** "just now", "5 min ago", "3 h ago", else the date. */
export function fmtAgo(at: number, now = Date.now()): string {
  const min = Math.round((now - at) / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min} min ago`
  const h = Math.round(min / 60)
  if (h < 24) return `${h} h ago`
  return new Date(at).toLocaleDateString([], { day: 'numeric', month: 'short' })
}

export const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

// Linear blend between two hex colors → hex string. t=0 → a, t=1 → b.
export function mixHex(a: string, b: string, t: number): string {
  const pa = parseHex(a)
  const pb = parseHex(b)
  const r = Math.round(pa[0] + (pb[0] - pa[0]) * t)
  const g = Math.round(pa[1] + (pb[1] - pa[1]) * t)
  const bl = Math.round(pa[2] + (pb[2] - pa[2]) * t)
  return `#${[r, g, bl].map((n) => n.toString(16).padStart(2, '0')).join('')}`
}

function parseHex(h: string): [number, number, number] {
  const s = h.replace('#', '')
  const n = parseInt(
    s.length === 3
      ? s
          .split('')
          .map((c) => c + c)
          .join('')
      : s,
    16,
  )
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

// A stable 0..1 number derived from a string — used to stagger bot animations.
export function hash01(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) & 0xffffffff
  return (Math.abs(h) % 1000) / 1000
}
