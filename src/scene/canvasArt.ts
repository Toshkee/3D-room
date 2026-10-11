import * as THREE from 'three'
import type { Bot } from '../types'
import type { DayLight } from './timeOfDay'
import { mixHex } from '../util'

// Procedural 2D art painted onto canvases and used as textures in the room:
// code on the desk monitors, attract-mode games on the arcade screens, the sky
// outside the window, posters, and the sprint whiteboard. No image assets.

export function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas')
  c.width = w
  c.height = h
  return { c, g: c.getContext('2d')! }
}

export function toTexture(c: HTMLCanvasElement, pixel = false): THREE.CanvasTexture {
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  if (pixel) {
    tex.magFilter = THREE.NearestFilter
    tex.minFilter = THREE.NearestFilter
    tex.generateMipmaps = false
  } else {
    tex.anisotropy = 4
  }
  return tex
}

/** Small deterministic RNG so procedural art is stable across reloads. */
export function rng(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Redraw once the display font is ready (canvas text otherwise falls back). */
export function whenFonts(fn: () => void) {
  fn()
  const fonts = (document as Document & { fonts?: FontFaceSet }).fonts
  if (!fonts) return
  Promise.all([fonts.load('600 40px Fredoka'), fonts.load('800 20px Nunito')])
    .then(fn)
    .catch(() => {})
}

function roundRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath()
  g.roundRect(x, y, w, h, r)
  g.fill()
}

// --- desk monitors: a tall sheet of "syntax-highlighted" code that scrolls ---
let codeCanvas: HTMLCanvasElement | null = null
export function codeSheet(): HTMLCanvasElement {
  if (codeCanvas) return codeCanvas
  const { c, g } = makeCanvas(256, 512)
  g.fillStyle = '#0d0b1a'
  g.fillRect(0, 0, 256, 512)
  const r = rng(7)
  const palette = ['#f4f1ff', '#f4f1ff', '#c9c2ff', '#ff9ccf', '#8fe3ff', '#ffe08a']
  let indent = 0
  for (let y = 10; y < 512; y += 15) {
    if (r() < 0.12) continue // blank line
    indent = Math.max(0, Math.min(4, indent + (r() < 0.3 ? 1 : r() < 0.3 ? -1 : 0)))
    let x = 12 + indent * 14
    const tokens = 1 + Math.floor(r() * 4)
    for (let i = 0; i < tokens && x < 230; i++) {
      const w = 14 + r() * 46
      g.fillStyle = palette[Math.floor(r() * palette.length)]
      roundRect(g, x, y, Math.min(w, 244 - x), 7, 3)
      x += w + 7
    }
  }
  codeCanvas = c
  return c
}

// --- arcade attract mode ------------------------------------------------------
export type GameKind = 'invaders' | 'pong' | 'warp'

export class ArcadeGame {
  readonly tex: THREE.CanvasTexture
  private g: CanvasRenderingContext2D
  private kind: GameKind
  private color: string
  private stars: { x: number; y: number; z: number }[] = []
  private ball = { x: 48, y: 36, vx: 38, vy: 27 }
  private score = 0

  constructor(kind: GameKind, color: string) {
    const { c, g } = makeCanvas(96, 72)
    this.g = g
    this.kind = kind
    this.color = color
    this.tex = toTexture(c, true)
    const r = rng(kind.length * 31)
    for (let i = 0; i < 40; i++) this.stars.push({ x: r() * 2 - 1, y: r() * 2 - 1, z: r() })
  }

  setColor(color: string) {
    this.color = color
  }

  draw(t: number, dt: number, playing: boolean) {
    const g = this.g
    g.fillStyle = '#07060f'
    g.fillRect(0, 0, 96, 72)
    if (this.kind === 'invaders') this.invaders(t)
    else if (this.kind === 'pong') this.pong(dt)
    else this.warp(dt, playing)
    if (playing) {
      this.score += dt * 37
      g.fillStyle = '#ffffff'
      g.font = 'bold 8px monospace'
      g.fillText(`P1 ${String(Math.floor(this.score)).padStart(5, '0')}`, 4, 9)
    } else if (Math.floor(t * 1.6) % 2 === 0) {
      g.fillStyle = '#ffffff'
      g.font = 'bold 8px monospace'
      g.fillText('INSERT COIN', 22, 68)
    }
    this.tex.needsUpdate = true
  }

  private invaders(t: number) {
    const g = this.g
    const off = Math.sin(t * 0.9) * 12
    const drop = (Math.floor(t / 4) % 4) * 3
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 6; col++) {
        const x = 18 + col * 11 + off
        const y = 14 + row * 9 + drop
        g.fillStyle = row === 0 ? '#ffffff' : this.color
        const frame = Math.floor(t * 2) % 2
        g.fillRect(x, y, 7, 4)
        g.fillRect(x + (frame ? 0 : 1), y + 4, 2, 2)
        g.fillRect(x + (frame ? 5 : 4), y + 4, 2, 2)
      }
    }
    const px = 48 + Math.sin(t * 1.3) * 30
    g.fillStyle = '#7dffb0'
    g.fillRect(px - 5, 58, 10, 4)
    g.fillRect(px - 1, 55, 2, 3)
    const shot = (t * 1.5) % 1
    g.fillStyle = '#ffffff'
    g.fillRect(px - 0.5, 54 - shot * 40, 1, 4)
  }

  private pong(dt: number) {
    const g = this.g
    const b = this.ball
    b.x += b.vx * dt
    b.y += b.vy * dt
    if (b.y < 4 || b.y > 66) b.vy *= -1
    if (b.x < 10 || b.x > 86) b.vx *= -1
    b.y = Math.max(4, Math.min(66, b.y))
    b.x = Math.max(10, Math.min(86, b.x))
    g.fillStyle = this.color
    for (let y = 2; y < 70; y += 6) g.fillRect(47, y, 2, 3)
    g.fillStyle = '#ffffff'
    g.fillRect(5, b.y - 7, 3, 14)
    g.fillRect(88, b.y - 7 + Math.sin(b.x * 0.1) * 3, 3, 14)
    g.fillRect(b.x - 1.5, b.y - 1.5, 3, 3)
  }

  private warp(dt: number, playing: boolean) {
    const g = this.g
    const speed = playing ? 0.9 : 0.45
    for (const s of this.stars) {
      s.z -= dt * speed
      if (s.z <= 0.02) s.z = 1
      const x = 48 + (s.x / s.z) * 20
      const y = 36 + (s.y / s.z) * 16
      const size = s.z < 0.3 ? 2 : 1
      g.fillStyle = s.z < 0.4 ? '#ffffff' : this.color
      g.fillRect(x, y, size, size)
    }
    g.fillStyle = this.color
    g.beginPath()
    g.moveTo(48, 50)
    g.lineTo(42, 62)
    g.lineTo(54, 62)
    g.closePath()
    g.fill()
  }
}

// --- the sky outside the window, by real time of day ----------------------------
const NIGHT = { top: '#0b1030', bottom: '#27306a' }
const DAY = { top: '#6fb5ff', bottom: '#d6ecff' }
const GOLD = { top: '#7c7fd6', bottom: '#ffbf7a' }

export function drawSky(g: CanvasRenderingContext2D, w: number, h: number, L: DayLight) {
  const top = mixHex(mixHex(NIGHT.top, DAY.top, L.day), GOLD.top, L.golden * 0.85)
  const bottom = mixHex(mixHex(NIGHT.bottom, DAY.bottom, L.day), GOLD.bottom, L.golden * 0.9)
  const grad = g.createLinearGradient(0, 0, 0, h)
  grad.addColorStop(0, top)
  grad.addColorStop(1, bottom)
  g.fillStyle = grad
  g.fillRect(0, 0, w, h)

  const r = rng(42)
  const night = 1 - L.day
  // stars
  if (night > 0.05) {
    for (let i = 0; i < 70; i++) {
      g.globalAlpha = night * (0.35 + r() * 0.65)
      g.fillStyle = '#ffffff'
      const s = r() < 0.15 ? 2 : 1
      g.fillRect(r() * w, r() * h * 0.62, s, s)
    }
    g.globalAlpha = 1
  }
  // sun / moon — the sun arcs left (morning) → right (evening)
  const sx = w * (0.5 + L.sunSide * 0.42)
  const sy = h * (0.78 - (L.sunAlt / 1.13) * 0.62)
  if (L.day > 0.05) {
    const sunCol = mixHex('#fff6cf', '#ffb05c', L.golden)
    const halo = g.createRadialGradient(sx, sy, 0, sx, sy, 46)
    halo.addColorStop(0, sunCol)
    halo.addColorStop(0.3, `${sunCol}88`)
    halo.addColorStop(1, `${sunCol}00`)
    g.globalAlpha = L.day
    g.fillStyle = halo
    g.fillRect(sx - 46, sy - 46, 92, 92)
    g.fillStyle = sunCol
    g.beginPath()
    g.arc(sx, sy, 11, 0, Math.PI * 2)
    g.fill()
    g.globalAlpha = 1
  }
  if (night > 0.3) {
    const mx = w * 0.72
    const my = h * 0.26
    g.globalAlpha = night
    const halo = g.createRadialGradient(mx, my, 0, mx, my, 30)
    halo.addColorStop(0, '#f4f1d055')
    halo.addColorStop(1, '#f4f1d000')
    g.fillStyle = halo
    g.fillRect(mx - 30, my - 30, 60, 60)
    g.fillStyle = '#f4f1d0'
    g.beginPath()
    g.arc(mx, my, 9, 0, Math.PI * 2)
    g.fill()
    g.fillStyle = top
    g.beginPath()
    g.arc(mx + 4, my - 3, 8, 0, Math.PI * 2)
    g.fill()
    g.globalAlpha = 1
  }
  // a few soft clouds by day
  if (L.day > 0.2) {
    g.globalAlpha = L.day * 0.75
    g.fillStyle = mixHex('#ffffff', '#ffd9b0', L.golden)
    for (let i = 0; i < 4; i++) {
      const cx = r() * w
      const cy = 14 + r() * h * 0.3
      for (let k = 0; k < 4; k++) {
        g.beginPath()
        g.ellipse(cx + k * 13, cy + (k % 2) * 3, 16, 7, 0, 0, Math.PI * 2)
        g.fill()
      }
    }
    g.globalAlpha = 1
  }
  // city skyline; windows light up at night
  const base = h
  let x = -4
  const bodyCol = mixHex('#141a38', '#8ea3c9', L.day * (1 - L.golden * 0.5))
  while (x < w) {
    const bw = 16 + r() * 26
    const bh = h * (0.16 + r() * 0.3)
    g.fillStyle = bodyCol
    g.fillRect(x, base - bh, bw, bh)
    if (night > 0.2) {
      for (let wy = base - bh + 5; wy < base - 4; wy += 7) {
        for (let wx = x + 3; wx < x + bw - 4; wx += 6) {
          if (r() < 0.42) {
            g.globalAlpha = night
            g.fillStyle = r() < 0.8 ? '#ffd27a' : '#9fd9ff'
            g.fillRect(wx, wy, 3, 3)
            g.globalAlpha = 1
          }
        }
      }
    }
    x += bw + 2 + r() * 4
  }
}

// --- posters --------------------------------------------------------------------
export type PosterKind = 'ship' | 'planet' | 'coffee' | 'pixel'

export function drawPoster(kind: PosterKind): HTMLCanvasElement {
  const { c, g } = makeCanvas(256, 352)
  const paint = () => {
    g.clearRect(0, 0, 256, 352)
    if (kind === 'ship') {
      const grad = g.createLinearGradient(0, 0, 0, 352)
      grad.addColorStop(0, '#7b6bff')
      grad.addColorStop(1, '#ff6fae')
      g.fillStyle = grad
      g.fillRect(0, 0, 256, 352)
      // rocket
      g.fillStyle = '#ffffff'
      g.beginPath()
      g.moveTo(128, 60)
      g.quadraticCurveTo(168, 120, 150, 210)
      g.lineTo(106, 210)
      g.quadraticCurveTo(88, 120, 128, 60)
      g.fill()
      g.fillStyle = '#2b2250'
      g.beginPath()
      g.arc(128, 135, 15, 0, Math.PI * 2)
      g.fill()
      g.fillStyle = '#ffd36b'
      g.beginPath()
      g.moveTo(108, 214)
      g.lineTo(128, 262)
      g.lineTo(148, 214)
      g.fill()
      g.fillStyle = '#ffffff'
      g.font = '700 46px Fredoka, system-ui'
      g.textAlign = 'center'
      g.fillText('SHIP IT', 128, 318)
    } else if (kind === 'planet') {
      g.fillStyle = '#141032'
      g.fillRect(0, 0, 256, 352)
      const r = rng(3)
      g.fillStyle = '#ffffff'
      for (let i = 0; i < 60; i++) g.fillRect(r() * 256, r() * 352, 2, 2)
      const pg = g.createRadialGradient(110, 150, 10, 128, 170, 90)
      pg.addColorStop(0, '#7ff0ff')
      pg.addColorStop(1, '#3a5bff')
      g.fillStyle = pg
      g.beginPath()
      g.arc(128, 170, 78, 0, Math.PI * 2)
      g.fill()
      g.strokeStyle = '#ffd36b'
      g.lineWidth = 9
      g.beginPath()
      g.ellipse(128, 172, 122, 26, -0.25, 0, Math.PI * 2)
      g.stroke()
      g.fillStyle = '#ffffff'
      g.font = '600 30px Fredoka, system-ui'
      g.textAlign = 'center'
      g.fillText('THINK BIG', 128, 318)
    } else if (kind === 'coffee') {
      g.fillStyle = '#ffe9c9'
      g.fillRect(0, 0, 256, 352)
      g.fillStyle = '#ff8a5c'
      g.fillRect(0, 0, 256, 70)
      g.fillStyle = '#5a3a2a'
      roundRect(g, 74, 130, 108, 120, 18)
      g.strokeStyle = '#5a3a2a'
      g.lineWidth = 14
      g.beginPath()
      g.arc(186, 186, 26, -1.2, 1.2)
      g.stroke()
      g.strokeStyle = '#c9a58a'
      g.lineWidth = 6
      for (const sx of [104, 128, 152]) {
        g.beginPath()
        g.moveTo(sx, 118)
        g.bezierCurveTo(sx - 12, 100, sx + 12, 88, sx, 70 + 18)
        g.stroke()
      }
      g.fillStyle = '#ffffff'
      g.font = '700 30px Fredoka, system-ui'
      g.textAlign = 'center'
      g.fillText('COFFEE', 128, 48)
      g.fillStyle = '#5a3a2a'
      g.font = '700 32px Fredoka, system-ui'
      g.fillText('→ CODE', 128, 304)
    } else {
      g.fillStyle = '#1b1640'
      g.fillRect(0, 0, 256, 352)
      // a pixel robot
      const px = 16
      const map = [
        '....XX....',
        '....XX....',
        '.XXXXXXXX.',
        '.X.OX.OX..',
        '.XXXXXXXX.',
        '.XX....XX.',
        '..XXXXXX..',
        '.XXXXXXXX.',
        'XX.XXXX.XX',
        '...X..X...',
      ]
      map.forEach((row, y) =>
        row.split('').forEach((ch, x) => {
          if (ch === '.') return
          g.fillStyle = ch === 'O' ? '#8ff0ff' : '#9a8bff'
          g.fillRect(48 + x * px, 60 + y * px, px - 1, px - 1)
        }),
      )
      g.fillStyle = '#ff79b6'
      g.font = '700 28px monospace'
      g.textAlign = 'center'
      g.fillText('HELLO_WORLD', 128, 318)
    }
  }
  whenFonts(paint)
  return c
}

// --- the sprint whiteboard: one sticky note per bot with its live task -------
function wrap(g: CanvasRenderingContext2D, text: string, maxW: number, maxLines: number): string[] {
  const words = text.split(/\s+/)
  const lines: string[] = []
  let cur = ''
  for (const w of words) {
    const next = cur ? `${cur} ${w}` : w
    if (g.measureText(next).width > maxW && cur) {
      lines.push(cur)
      cur = w
      if (lines.length === maxLines) break
    } else cur = next
  }
  if (lines.length < maxLines && cur) lines.push(cur)
  if (lines.length === maxLines && words.join(' ') !== lines.join(' ')) {
    lines[maxLines - 1] = `${lines[maxLines - 1].replace(/\s+\S*$/, '')}…`
  }
  return lines
}

export function drawWhiteboard(g: CanvasRenderingContext2D, w: number, h: number, bots: Bot[]) {
  g.fillStyle = '#fbfbff'
  g.fillRect(0, 0, w, h)
  // faint marker scribbles
  g.strokeStyle = '#d9dcef'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(w - 150, h - 40)
  g.bezierCurveTo(w - 110, h - 90, w - 60, h - 20, w - 30, h - 70)
  g.stroke()
  g.fillStyle = '#4b3fd6'
  g.font = '600 34px Fredoka, system-ui'
  g.textAlign = 'left'
  g.fillText('This sprint', 26, 46)
  g.strokeStyle = '#4b3fd6'
  g.lineWidth = 3
  g.beginPath()
  g.moveTo(26, 56)
  g.lineTo(196, 56)
  g.stroke()

  const shown = bots.slice(0, 8)
  const cols = 4
  const nw = (w - 26 * 2 - 18 * (cols - 1)) / cols
  const nh = 150
  shown.forEach((b, i) => {
    const col = i % cols
    const row = Math.floor(i / cols)
    const x = 26 + col * (nw + 18)
    const y = 78 + row * (nh + 22)
    g.save()
    g.translate(x + nw / 2, y + nh / 2)
    g.rotate(((i * 37) % 7 - 3) * 0.012)
    g.translate(-nw / 2, -nh / 2)
    g.fillStyle = 'rgba(40,30,90,0.16)'
    g.fillRect(4, 6, nw, nh)
    g.fillStyle = mixHex(b.accent, '#ffffff', 0.62)
    g.fillRect(0, 0, nw, nh)
    g.fillStyle = mixHex(b.accent, '#ffffff', 0.4)
    g.fillRect(0, 0, nw, 10)
    g.fillStyle = mixHex(b.accent, '#000000', 0.45)
    g.font = '700 22px Fredoka, system-ui'
    g.fillText(b.name, 12, 36)
    if (b.status === 'done') {
      g.fillStyle = '#12a06e'
      g.font = '800 22px Nunito, system-ui'
      g.fillText('✓', nw - 30, 36)
    }
    g.fillStyle = '#2a2350'
    g.font = '700 15px Nunito, system-ui'
    wrap(g, b.task, nw - 24, 4).forEach((line, li) => g.fillText(line, 12, 62 + li * 20))
    g.restore()
  })
}
