import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import type { RoomPalette } from '../theme'
import type { Bot } from '../types'
import type { DayLight } from './timeOfDay'
import type { World } from './world'
import { drawPoster, drawSky, drawWhiteboard, makeCanvas, rng, toTexture, whenFonts, type PosterKind } from './canvasArt'
import { clamp, mixHex } from '../util'

// Lived-in details that make the lounge feel inhabited: a window onto the real
// sky (time of day) with sunlight falling on the floor, a ticking wall clock, a
// bookshelf, posters, warm lamps, a steaming mug, the whiteboard with every
// bot's live task, and the door new bots walk in through.

const WALL_BACK_Z = -9.0 // inner face of the back wall
const WALL_LEFT_X = -11.0 // inner face of the left wall

// --- window (back wall, above the arcades) ------------------------------------
const WIN = { x: -3.4, y: 3.3, w: 6.0, h: 1.4 }

export function SkyWindow({ p, day }: { p: RoomPalette; day: DayLight }) {
  const { c, g } = useMemo(() => makeCanvas(384, 102), [])
  const tex = useMemo(() => toTexture(c), [c])
  useEffect(() => {
    drawSky(g, 384, 102, day)
    tex.needsUpdate = true
  }, [g, tex, day])
  useEffect(() => () => tex.dispose(), [tex])
  const glow = 1 + day.day * 0.12
  const z = WALL_BACK_Z
  const bar = (x: number, y: number, w: number, h: number, key: string) => (
    <mesh key={key} position={[x, y, z + 0.05]}>
      <boxGeometry args={[w, h, 0.1]} />
      <meshStandardMaterial color={p.frame} roughness={0.8} />
    </mesh>
  )
  return (
    <group position={[WIN.x, WIN.y, 0]}>
      <mesh position={[0, 0, z + 0.005]}>
        <planeGeometry args={[WIN.w, WIN.h]} />
        <meshBasicMaterial map={tex} toneMapped={false} color={[glow, glow, glow]} />
      </mesh>
      {bar(0, WIN.h / 2 + 0.05, WIN.w + 0.2, 0.1, 't')}
      {bar(0, -WIN.h / 2 - 0.05, WIN.w + 0.2, 0.1, 'b')}
      {bar(-WIN.w / 2 - 0.05, 0, 0.1, WIN.h + 0.2, 'l')}
      {bar(WIN.w / 2 + 0.05, 0, 0.1, WIN.h + 0.2, 'r')}
      {bar(-WIN.w / 6, 0, 0.07, WIN.h, 'm1')}
      {bar(WIN.w / 6, 0, 0.07, WIN.h, 'm2')}
      <mesh position={[0, -WIN.h / 2 - 0.12, z + 0.13]}>
        <boxGeometry args={[WIN.w + 0.4, 0.07, 0.28]} />
        <meshStandardMaterial color={p.frame} roughness={0.8} />
      </mesh>
    </group>
  )
}

// Soft three-pane light shape, used for the sun (or moon) patch on the floor.
function paneTexture(): THREE.CanvasTexture {
  const { c, g } = makeCanvas(256, 96)
  for (let pane = 0; pane < 3; pane++) {
    const x0 = 8 + pane * 82
    for (let k = 0; k < 10; k++) {
      g.fillStyle = 'rgba(255,255,255,0.11)'
      g.fillRect(x0 + k * 1.6, 8 + k * 1.6, 76 - k * 3.2, 80 - k * 3.2)
    }
  }
  return toTexture(c)
}

export function SunPatch({ day, dark }: { day: DayLight; dark: boolean }) {
  const tex = useMemo(paneTexture, [])
  useEffect(() => () => tex.dispose(), [tex])
  const moon = 1 - day.day
  // Throw of the window's light onto the floor from the sun's elevation.
  const alt = day.day > 0.05 ? day.sunAlt : 0.62
  const tan = Math.tan(alt)
  const near = clamp((WIN.y - WIN.h / 2) / tan, 1.2, 6)
  const far = clamp((WIN.y + WIN.h / 2) / tan, near + 0.8, 9)
  const mid = (near + far) / 2
  const side = day.day > 0.05 ? day.sunSide : 0.35
  const shiftX = -side * mid * 0.55
  const color = day.day > 0.05 ? mixHex('#fff1c9', '#ffae5c', day.golden) : '#9fb4ff'
  const opacity = day.day * (dark ? 0.32 : 0.55) + moon * (dark ? 0.08 : 0.07)
  if (opacity < 0.02) return null
  return (
    <mesh
      position={[WIN.x + shiftX, 0.03, WALL_BACK_Z + mid]}
      rotation={[-Math.PI / 2, 0, Math.atan2(shiftX, mid) * 0.8]}
      renderOrder={1}
    >
      <planeGeometry args={[WIN.w * 0.98, far - near]} />
      <meshBasicMaterial
        map={tex}
        color={color}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

// --- wall clock (left wall, above the middle desk) — real local time ----------
export function WallClock({ p }: { p: RoomPalette }) {
  const hour = useRef<THREE.Group>(null)
  const minute = useRef<THREE.Group>(null)
  const second = useRef<THREE.Group>(null)
  useFrame(() => {
    const d = new Date()
    const s = d.getSeconds() + d.getMilliseconds() / 1000
    const m = d.getMinutes() + s / 60
    const h = (d.getHours() % 12) + m / 60
    if (second.current) second.current.rotation.z = -(s / 60) * Math.PI * 2
    if (minute.current) minute.current.rotation.z = -(m / 60) * Math.PI * 2
    if (hour.current) hour.current.rotation.z = -(h / 12) * Math.PI * 2
  })
  return (
    <group position={[WALL_LEFT_X + 0.03, 3.35, 0]} rotation-y={Math.PI / 2}>
      <mesh rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.5, 0.5, 0.07, 40]} />
        <meshStandardMaterial color={p.cabinetTop} roughness={0.6} />
      </mesh>
      <mesh rotation-x={Math.PI / 2} position={[0, 0, 0.03]}>
        <cylinderGeometry args={[0.43, 0.43, 0.03, 40]} />
        <meshStandardMaterial color="#fbf9ff" roughness={0.7} emissive="#fbf9ff" emissiveIntensity={0.12} />
      </mesh>
      {Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2
        const long = i % 3 === 0
        return (
          <mesh key={i} position={[Math.sin(a) * 0.36, Math.cos(a) * 0.36, 0.05]} rotation-z={-a}>
            <boxGeometry args={[0.025, long ? 0.08 : 0.04, 0.01]} />
            <meshStandardMaterial color="#2a2350" />
          </mesh>
        )
      })}
      <group ref={hour} position={[0, 0, 0.055]}>
        <mesh position={[0, 0.1, 0]}>
          <boxGeometry args={[0.04, 0.22, 0.012]} />
          <meshStandardMaterial color="#2a2350" />
        </mesh>
      </group>
      <group ref={minute} position={[0, 0, 0.065]}>
        <mesh position={[0, 0.15, 0]}>
          <boxGeometry args={[0.028, 0.32, 0.012]} />
          <meshStandardMaterial color="#2a2350" />
        </mesh>
      </group>
      <group ref={second} position={[0, 0, 0.075]}>
        <mesh position={[0, 0.13, 0]}>
          <boxGeometry args={[0.012, 0.34, 0.008]} />
          <meshStandardMaterial color={p.neonB} emissive={p.neonB} emissiveIntensity={0.5} />
        </mesh>
      </group>
      <mesh position={[0, 0, 0.085]} rotation-x={Math.PI / 2}>
        <cylinderGeometry args={[0.025, 0.025, 0.02, 12]} />
        <meshStandardMaterial color={p.neonB} />
      </mesh>
    </group>
  )
}

// --- bookshelf (left wall, back corner) — one merged mesh, vertex-colored -----
function boxWithColor(w: number, h: number, d: number, x: number, y: number, z: number, color: string, rotZ = 0) {
  const geo = new THREE.BoxGeometry(w, h, d)
  if (rotZ) geo.rotateZ(rotZ)
  geo.translate(x, y, z)
  const col = new THREE.Color(color)
  const n = geo.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) {
    arr[i * 3] = col.r
    arr[i * 3 + 1] = col.g
    arr[i * 3 + 2] = col.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return geo
}

export function Bookshelf({ p }: { p: RoomPalette }) {
  const geo = useMemo(() => {
    const W = 2.2
    const H = 2.3
    const D = 0.5
    const parts: THREE.BufferGeometry[] = []
    const wood = p.desk
    parts.push(boxWithColor(0.07, H, D, -W / 2, H / 2, 0, wood))
    parts.push(boxWithColor(0.07, H, D, W / 2, H / 2, 0, wood))
    parts.push(boxWithColor(W, 0.07, D, 0, H, 0, wood))
    parts.push(boxWithColor(W, 0.05, D, 0, 0.03, 0, wood))
    parts.push(boxWithColor(W, H, 0.03, 0, H / 2, -D / 2, mixHex(wood, '#000000', 0.25)))
    const shelves = [0.55, 1.1, 1.65]
    for (const y of shelves) parts.push(boxWithColor(W, 0.05, D, 0, y, 0, wood))
    const r = rng(11)
    const colors = [p.neonA, p.neonB, p.neonC, '#f5a524', '#22c55e', '#ff7a45', '#f4f1ff', '#2a2350']
    const levels = [0.055, 0.575, 1.125, 1.675]
    for (const base of levels) {
      let x = -W / 2 + 0.08
      while (x < W / 2 - 0.12) {
        if (r() < 0.08) {
          x += 0.18 // a gap
          continue
        }
        const bw = 0.06 + r() * 0.08
        const bh = 0.3 + r() * 0.16
        const lean = r() < 0.1 ? 0.18 : 0
        parts.push(
          boxWithColor(bw, bh, 0.34, x + bw / 2, base + bh / 2 + 0.02, 0.02, colors[Math.floor(r() * colors.length)], lean),
        )
        x += bw + 0.008
      }
    }
    const merged = mergeGeometries(parts)!
    parts.forEach((g) => g.dispose())
    return merged
  }, [p])
  useEffect(() => () => geo.dispose(), [geo])
  return (
    <mesh geometry={geo} position={[WALL_LEFT_X + 0.27, 0, -7.2]} rotation-y={Math.PI / 2}>
      <meshStandardMaterial vertexColors roughness={0.85} />
    </mesh>
  )
}

// --- posters + framed art ---------------------------------------------------------
export function Poster({
  kind,
  position,
  rotationY = 0,
  size = [1.1, 1.5],
  dark,
}: {
  kind: PosterKind
  position: [number, number, number]
  rotationY?: number
  size?: [number, number]
  dark: boolean
}) {
  const tex = useMemo(() => toTexture(drawPoster(kind)), [kind])
  useEffect(() => {
    // the poster canvas may repaint once the display font loads
    const id = setTimeout(() => (tex.needsUpdate = true), 1200)
    return () => {
      clearTimeout(id)
      tex.dispose()
    }
  }, [tex])
  return (
    <group position={position} rotation-y={rotationY}>
      <mesh position={[0, 0, -0.012]}>
        <boxGeometry args={[size[0] + 0.08, size[1] + 0.08, 0.02]} />
        <meshStandardMaterial color="#2a2350" roughness={0.7} />
      </mesh>
      <mesh>
        <planeGeometry args={size} />
        <meshStandardMaterial
          map={tex}
          emissiveMap={tex}
          emissive="#ffffff"
          emissiveIntensity={dark ? 0.42 : 0.12}
          roughness={0.9}
        />
      </mesh>
    </group>
  )
}

// --- the sprint whiteboard: one sticky note per bot with its live task --------------
// A rolling whiteboard standing in the work corner, turned toward the camera.
export function Whiteboard({ bots, dark, p }: { bots: Bot[]; dark: boolean; p: RoomPalette }) {
  const { c, g } = useMemo(() => makeCanvas(768, 480), [])
  const tex = useMemo(() => toTexture(c), [c])
  const sig = bots.map((b) => `${b.name}|${b.accent}|${b.task}|${b.status === 'done'}`).join('§')
  const latest = useRef(bots)
  latest.current = bots
  useEffect(() => {
    whenFonts(() => {
      drawWhiteboard(g, 768, 480, latest.current)
      tex.needsUpdate = true
    })
  }, [g, tex, sig])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <group position={[-8.0, 0, 6.2]} rotation-y={Math.PI / 4}>
      {/* legs on casters */}
      {[-1.31, 1.31].map((x) => (
        <group key={x} position={[x, 0, 0]}>
          <mesh position={[0, 1.0, 0]}>
            <boxGeometry args={[0.06, 2.0, 0.06]} />
            <meshStandardMaterial color={p.cabinetTop} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.06, 0]}>
            <boxGeometry args={[0.08, 0.06, 0.7]} />
            <meshStandardMaterial color={p.cabinetTop} roughness={0.5} />
          </mesh>
          {[-0.3, 0.3].map((z) => (
            <mesh key={z} position={[0, 0.04, z]}>
              <sphereGeometry args={[0.045, 10, 8]} />
              <meshStandardMaterial color="#1a1530" />
            </mesh>
          ))}
        </group>
      ))}
      <group position={[0, 1.55, 0]}>
      <mesh position={[0, 0, -0.03]}>
        <boxGeometry args={[2.5, 1.62, 0.05]} />
        <meshStandardMaterial color="#c9cbe0" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0, 0.0]}>
        <planeGeometry args={[2.4, 1.5]} />
        <meshStandardMaterial
          map={tex}
          emissiveMap={tex}
          emissive="#ffffff"
          emissiveIntensity={dark ? 0.5 : 0.14}
          roughness={0.55}
        />
      </mesh>
      {/* marker tray */}
      <mesh position={[0, -0.84, 0.08]}>
        <boxGeometry args={[1.4, 0.04, 0.14]} />
        <meshStandardMaterial color="#c9cbe0" roughness={0.5} />
      </mesh>
      {['#4b3fd6', '#ff5f6d', '#14b8a6'].map((col, i) => (
        <mesh key={col} position={[-0.4 + i * 0.22, -0.8, 0.1]} rotation-z={Math.PI / 2}>
          <cylinderGeometry args={[0.025, 0.025, 0.18, 8]} />
          <meshStandardMaterial color={col} roughness={0.5} />
        </mesh>
      ))}
      </group>
    </group>
  )
}

// --- warm lamps (real point lights, gently flickering) ------------------------------
const LAMP_WARM = '#ffb877'

function Flicker({ base, seed }: { base: number; seed: number }) {
  const light = useRef<THREE.PointLight>(null)
  useFrame(({ clock }) => {
    if (!light.current) return
    const t = clock.elapsedTime + seed
    light.current.intensity = base * (1 + Math.sin(t * 13.7) * 0.015 + Math.sin(t * 3.1) * 0.02)
  })
  return <pointLight ref={light} color={LAMP_WARM} intensity={base} distance={6.5} decay={2} />
}

export function SideLamp({ p, dark }: { p: RoomPalette; dark: boolean }) {
  return (
    <group position={[6.5, 0, 3.75]}>
      <mesh position={[0, 0.28, 0]}>
        <cylinderGeometry args={[0.3, 0.3, 0.56, 20]} />
        <meshStandardMaterial color={p.wood} roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.63, 0]}>
        <cylinderGeometry args={[0.07, 0.11, 0.14, 12]} />
        <meshStandardMaterial color={p.cabinetTop} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.85, 0]}>
        <cylinderGeometry args={[0.13, 0.2, 0.32, 18, 1, true]} />
        <meshStandardMaterial color="#ffe6c4" emissive={LAMP_WARM} emissiveIntensity={dark ? 1.1 : 0.55} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <group position={[0, 0.82, 0]}>
        <Flicker base={dark ? 3.2 : 1.4} seed={1} />
      </group>
    </group>
  )
}

export function FloorLamp({ p, dark }: { p: RoomPalette; dark: boolean }) {
  return (
    <group position={[-0.25, 0, 6.15]}>
      <mesh position={[0, 0.04, 0]}>
        <cylinderGeometry args={[0.28, 0.32, 0.08, 20]} />
        <meshStandardMaterial color={p.cabinetTop} roughness={0.6} />
      </mesh>
      <mesh position={[0, 1.05, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 2.0, 8]} />
        <meshStandardMaterial color={p.cabinetTop} roughness={0.6} />
      </mesh>
      <mesh position={[0, 2.12, 0]}>
        <cylinderGeometry args={[0.2, 0.34, 0.36, 20, 1, true]} />
        <meshStandardMaterial color="#ffe6c4" emissive={LAMP_WARM} emissiveIntensity={dark ? 1.2 : 0.6} side={THREE.DoubleSide} toneMapped={false} />
      </mesh>
      <group position={[0, 2.0, 0]}>
        <Flicker base={dark ? 4.2 : 1.8} seed={7} />
      </group>
    </group>
  )
}

// --- a steaming mug on the coffee table ------------------------------------------------
export function SteamingMug({ reducedMotion }: { reducedMotion: boolean }) {
  const puffs = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const g = puffs.current
    if (!g) return
    const t = clock.elapsedTime
    g.children.forEach((c, i) => {
      const u = (t * 0.32 + i / g.children.length) % 1
      c.position.set(Math.sin(t * 1.3 + i * 2) * 0.05 * u, 0.12 + u * 0.6, Math.cos(t + i) * 0.03 * u)
      c.scale.setScalar(0.6 + u * 1.1)
      const m = (c as THREE.Mesh).material as THREE.MeshBasicMaterial
      m.opacity = reducedMotion ? 0 : Math.min(1, u * 5) * (1 - u) * 0.55
    })
  })
  return (
    <group position={[3.25, 0.57, 0.75]}>
      <mesh position={[0, 0.08, 0]}>
        <cylinderGeometry args={[0.085, 0.075, 0.16, 16]} />
        <meshStandardMaterial color="#fbf6ff" roughness={0.5} />
      </mesh>
      <mesh position={[0.1, 0.08, 0]} rotation-x={Math.PI / 2}>
        <torusGeometry args={[0.045, 0.014, 8, 16]} />
        <meshStandardMaterial color="#fbf6ff" roughness={0.5} />
      </mesh>
      <mesh position={[0, 0.155, 0]} rotation-x={-Math.PI / 2}>
        <circleGeometry args={[0.07, 16]} />
        <meshStandardMaterial color="#6b4430" roughness={0.4} />
      </mesh>
      <group ref={puffs}>
        {[0, 1, 2, 3].map((i) => (
          <mesh key={i}>
            <sphereGeometry args={[0.045, 10, 8]} />
            <meshBasicMaterial color="#ffffff" transparent opacity={0} depthWrite={false} />
          </mesh>
        ))}
      </group>
    </group>
  )
}

// --- the door (back wall, right) — swings open when a new bot walks in ---------------
export function Door({ p, world }: { p: RoomPalette; world: World }) {
  const hinge = useRef<THREE.Group>(null)
  useFrame(({ clock }, dt) => {
    if (!hinge.current) return
    const open = world.doorOpenUntil > clock.elapsedTime
    const target = open ? -1.35 : 0
    hinge.current.rotation.y += (target - hinge.current.rotation.y) * Math.min(1, dt * (open ? 5 : 3))
  })
  return (
    <group position={[9.6, 0, WALL_BACK_Z]}>
      <mesh position={[0, 1.17, 0.004]}>
        <planeGeometry args={[1.14, 2.34]} />
        <meshBasicMaterial color="#0b0918" />
      </mesh>
      {[-0.63, 0.63].map((x) => (
        <mesh key={x} position={[x, 1.2, 0.06]}>
          <boxGeometry args={[0.12, 2.4, 0.14]} />
          <meshStandardMaterial color={p.frame} roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 2.44, 0.06]}>
        <boxGeometry args={[1.38, 0.12, 0.14]} />
        <meshStandardMaterial color={p.frame} roughness={0.8} />
      </mesh>
      <mesh position={[0, 2.78, 0.04]}>
        <boxGeometry args={[0.8, 0.16, 0.05]} />
        <meshStandardMaterial color={p.neonC} emissive={p.neonC} emissiveIntensity={0.9} toneMapped={false} />
      </mesh>
      <group ref={hinge} position={[-0.56, 0, 0.05]}>
        <mesh position={[0.56, 1.16, 0]}>
          <boxGeometry args={[1.1, 2.3, 0.06]} />
          <meshStandardMaterial color={p.desk} roughness={0.75} />
        </mesh>
        <mesh position={[0.56, 1.6, 0.035]}>
          <boxGeometry args={[0.7, 0.5, 0.01]} />
          <meshStandardMaterial color={mixHex(p.desk, '#ffffff', 0.25)} roughness={0.75} />
        </mesh>
        <mesh position={[0.98, 1.12, 0.06]}>
          <sphereGeometry args={[0.045, 12, 10]} />
          <meshStandardMaterial color="#d8c48a" roughness={0.3} />
        </mesh>
      </group>
    </group>
  )
}
