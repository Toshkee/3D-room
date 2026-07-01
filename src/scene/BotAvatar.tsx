import { useEffect, useRef, useState } from 'react'
import { Html, RoundedBox } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Bot } from '../types'
import { SEATS } from '../data/bots'
import { ROAM, chooseGoal, nearestNode, node, pathTo, type Occupancy } from '../data/roam'
import { StatusPill } from '../components/StatusPill'
import { ROLE_ICON } from '../components/icons'
import { hash01, mixHex } from '../util'

const EYE = '#8ff0ff'
const LABEL_Y = 2.0

type Mode = 'dwell' | 'travel'

// Shorten a yaw delta to [-PI, PI] for smooth turning.
function shortAngle(a: number) {
  return ((a + Math.PI) % (Math.PI * 2)) - Math.PI
}

// A cute low-poly robot that roams the lounge on its own (DWELL↔TRAVEL over the
// roam graph): strolls between the arcades, desks, and lounge, plays the
// arcades (pumping arms), then moves on — never walking through furniture
// because every edge is a clear segment. Comes to attention (stops + faces you)
// when selected. Writes its live position + node claims into shared refs so
// bots don't target the same spot and the camera can follow the selected one.
export function BotAvatar({
  bot,
  selected,
  onSelect,
  reducedMotion,
  positions,
  occupancy,
}: {
  bot: Bot
  selected: boolean
  onSelect: (id: string) => void
  reducedMotion: boolean
  positions: { current: Record<string, THREE.Vector3> }
  occupancy: { current: Occupancy }
}) {
  const phase = hash01(bot.id) * Math.PI * 2
  const RoleIcon = ROLE_ICON[bot.role]

  const rootG = useRef<THREE.Group>(null)
  const scaleG = useRef<THREE.Group>(null)
  const bodyG = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const eyeL = useRef<THREE.Mesh>(null)
  const eyeR = useRef<THREE.Mesh>(null)
  const tip = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.Mesh>(null)
  const down = useRef<{ x: number; y: number } | null>(null)
  const [hovered, setHovered] = useState(false)

  const headColor = mixHex(bot.accent, '#ffffff', 0.7)
  const armColor = mixHex(bot.accent, '#000000', 0.12)
  const bright = mixHex(bot.accent, '#ffffff', 0.25)

  // --- FSM state (refs so it never triggers React re-renders) --------------
  const fsm = useRef({
    mode: 'dwell' as Mode,
    current: '',
    path: [] as string[],
    pi: 0,
    dwellUntil: 0,
    yaw: 0,
    pos: new THREE.Vector3(),
    inited: false,
  })

  // Register position slot + claim start node; release on unmount.
  useEffect(() => {
    const seat = SEATS[bot.seat] ?? SEATS[0]
    const start = nearestNode(seat[0], seat[1])
    const [sx, sz] = node(start).pos
    const f = fsm.current
    f.current = start
    f.pos.set(sx, 0, sz)
    f.dwellUntil = 0.5 + Math.random() * ROAM.DWELL_MAX
    f.yaw = node(start).face ?? 0
    f.inited = true
    positions.current[bot.id] = f.pos
    if (rootG.current) rootG.current.position.set(sx, 0, sz)
    if (occupancy.current && !occupancy.current.claim[start]) occupancy.current.claim[start] = bot.id
    return () => {
      delete positions.current[bot.id]
      const occ = occupancy.current
      for (const k of Object.keys(occ.claim)) if (occ.claim[k] === bot.id) delete occ.claim[k]
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot.id, bot.seat])

  useFrame(({ clock, camera }, rawDelta) => {
    const f = fsm.current
    if (!f.inited) return
    const dt = Math.min(rawDelta, 0.1)
    const t = clock.elapsedTime
    const occ = occupancy.current
    const active = bot.status === 'working' || bot.status === 'thinking'

    let moving = false
    let faceYaw: number | null = null

    if (selected) {
      // Come to attention: stop where you are, look at the camera.
      faceYaw = Math.atan2(camera.position.x - f.pos.x, camera.position.z - f.pos.z)
    } else if (reducedMotion) {
      const n = node(f.current)
      faceYaw = n.face ?? Math.atan2(camera.position.x - f.pos.x, camera.position.z - f.pos.z)
    } else if (f.mode === 'dwell') {
      const n = node(f.current)
      faceYaw = n.face ?? Math.atan2(camera.position.x - f.pos.x, camera.position.z - f.pos.z)
      if (t > f.dwellUntil && occ) {
        const goal = chooseGoal(f.current, occ, bot.id)
        const path = goal ? pathTo(f.current, goal) : []
        if (goal && path.length) {
          if (occ.claim[f.current] === bot.id) delete occ.claim[f.current]
          occ.claim[goal] = bot.id
          f.path = path
          f.pi = 0
          f.mode = 'travel'
        } else {
          f.dwellUntil = t + 1 + Math.random() * 2
        }
      }
    } else {
      // travel
      const target = node(f.path[f.pi]).pos
      const tx = target[0]
      const tz = target[1]
      const dx = tx - f.pos.x
      const dz = tz - f.pos.z
      const dist = Math.hypot(dx, dz)
      if (dist < ROAM.ARRIVE) {
        f.current = f.path[f.pi]
        f.pi += 1
        if (f.pi >= f.path.length) {
          f.mode = 'dwell'
          f.dwellUntil = t + ROAM.DWELL_MIN + Math.random() * (ROAM.DWELL_MAX - ROAM.DWELL_MIN)
        }
      } else {
        const step = Math.min(ROAM.WALK * dt, dist)
        f.pos.x += (dx / dist) * step
        f.pos.z += (dz / dist) * step
        faceYaw = Math.atan2(dx, dz)
        moving = true
      }
    }

    // Soft separation so bodies don't interpenetrate (selected bot never yields).
    if (!selected && positions.current) {
      for (const [oid, op] of Object.entries(positions.current)) {
        if (oid === bot.id) continue
        const dx = f.pos.x - op.x
        const dz = f.pos.z - op.z
        const d = Math.hypot(dx, dz)
        if (d > 0.001 && d < ROAM.BODY_SEP && bot.id > oid) {
          const push = (ROAM.BODY_SEP - d) * 0.5
          f.pos.x += (dx / d) * push
          f.pos.z += (dz / d) * push
        }
      }
    }

    // Apply transforms.
    if (rootG.current) rootG.current.position.set(f.pos.x, 0, f.pos.z)

    // Sitting: at a seat node while dwelling, the body rises onto the cushion.
    // The floor ring + shadow stay grounded (they live outside scaleG).
    const dwellNode = node(f.current)
    const sitting = !selected && !moving && f.mode === 'dwell' && dwellNode.sit != null
    const seatLift = sitting ? dwellNode.sit! : 0

    if (bodyG.current) {
      const g = bodyG.current
      const bobSpeed = moving ? 8 : active ? 3.1 : 2
      const bobAmt = moving ? 0.05 : sitting ? 0.02 : active ? 0.07 : 0.045
      g.position.y = reducedMotion ? 0 : Math.sin(t * bobSpeed + phase) * bobAmt
      g.rotation.z = reducedMotion ? 0 : Math.sin(t * 1.4 + phase) * 0.05
      if (faceYaw != null) {
        if (reducedMotion) g.rotation.y = faceYaw
        else g.rotation.y += shortAngle(faceYaw - g.rotation.y) * (moving ? 0.18 : 0.09)
      }
    }

    // Arcade "playing": pump the arms while dwelling at an arcade.
    const atArcade = f.mode === 'dwell' && !selected && node(f.current).kind === 'arcade'
    const pump = atArcade && !reducedMotion ? Math.sin(t * 9 + phase) * 0.5 : 0
    if (armL.current) armL.current.rotation.x = moving ? Math.sin(t * 8 + phase) * 0.5 : -pump
    if (armR.current) armR.current.rotation.x = moving ? -Math.sin(t * 8 + phase) * 0.5 : pump

    if (!reducedMotion && eyeL.current && eyeR.current) {
      const blink = (t * 0.42 + phase) % 1 > 0.94 ? 0.14 : 1
      eyeL.current.scale.y = blink
      eyeR.current.scale.y = blink
    }
    if (tip.current) {
      const m = tip.current.material as THREE.MeshStandardMaterial
      m.emissiveIntensity = active && !reducedMotion ? 1.1 + Math.sin(t * 3.4 + phase) * 0.6 : 0.9
    }
    if (ring.current) {
      // Steady (no pulse) so it doesn't read as blinking; brighter when selected.
      const mat = ring.current.material as THREE.MeshBasicMaterial
      mat.opacity = selected ? 0.6 : active ? 0.34 : 0.22
      ring.current.scale.setScalar(selected ? 1.14 : 1)
    }
    if (scaleG.current) {
      const target = hovered || selected ? 1.09 : 1
      scaleG.current.scale.setScalar(THREE.MathUtils.lerp(scaleG.current.scale.x, target, 0.15))
      scaleG.current.position.y = THREE.MathUtils.lerp(scaleG.current.position.y, seatLift, 0.12)
    }
  })

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    down.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY }
  }
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    const d = down.current
    down.current = null
    if (!d) return
    if (Math.hypot(e.nativeEvent.clientX - d.x, e.nativeEvent.clientY - d.y) < 6) {
      e.stopPropagation()
      onSelect(bot.id)
    }
  }
  const enter = () => {
    setHovered(true)
    document.body.style.cursor = 'pointer'
  }
  const leave = () => {
    setHovered(false)
    document.body.style.cursor = ''
  }

  return (
    <group ref={rootG}>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.08, 0]} renderOrder={2}>
        <ringGeometry args={[0.44, 0.6, 44]} />
        <meshBasicMaterial
          color={bot.accent}
          transparent
          opacity={0.28}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      <group ref={scaleG} onPointerDown={onDown} onPointerUp={onUp} onPointerOver={enter} onPointerOut={leave}>
        <group ref={bodyG}>
          <RoundedBox args={[0.66, 0.66, 0.46]} radius={0.18} smoothness={3} position={[0, 0.62, 0]}>
            <meshStandardMaterial color={bot.accent} roughness={0.6} />
          </RoundedBox>
          <mesh position={[0, 0.64, 0.235]}>
            <boxGeometry args={[0.2, 0.2, 0.02]} />
            <meshStandardMaterial color={bright} emissive={bot.accent} emissiveIntensity={0.9} toneMapped={false} />
          </mesh>
          {/* arms (pivot at shoulder) */}
          <group ref={armL} position={[-0.44, 0.74, 0]}>
            <RoundedBox args={[0.15, 0.32, 0.15]} radius={0.07} smoothness={2} position={[0, -0.16, 0]}>
              <meshStandardMaterial color={armColor} roughness={0.6} />
            </RoundedBox>
          </group>
          <group ref={armR} position={[0.44, 0.74, 0]}>
            <RoundedBox args={[0.15, 0.32, 0.15]} radius={0.07} smoothness={2} position={[0, -0.16, 0]}>
              <meshStandardMaterial color={armColor} roughness={0.6} />
            </RoundedBox>
          </group>
          <group position={[0, 1.12, 0]}>
            <RoundedBox args={[0.6, 0.5, 0.46]} radius={0.18} smoothness={3}>
              <meshStandardMaterial color={headColor} roughness={0.55} />
            </RoundedBox>
            <RoundedBox args={[0.44, 0.3, 0.06]} radius={0.09} smoothness={2} position={[0, 0.02, 0.22]}>
              <meshStandardMaterial color="#171226" roughness={0.4} />
            </RoundedBox>
            <mesh ref={eyeL} position={[-0.1, 0.03, 0.26]}>
              <sphereGeometry args={[0.055, 16, 16]} />
              <meshStandardMaterial color={EYE} emissive={EYE} emissiveIntensity={1.1} toneMapped={false} />
            </mesh>
            <mesh ref={eyeR} position={[0.1, 0.03, 0.26]}>
              <sphereGeometry args={[0.055, 16, 16]} />
              <meshStandardMaterial color={EYE} emissive={EYE} emissiveIntensity={1.1} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0.33, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 0.22, 8]} />
              <meshStandardMaterial color={armColor} roughness={0.6} />
            </mesh>
            <mesh ref={tip} position={[0, 0.47, 0]}>
              <sphereGeometry args={[0.06, 16, 16]} />
              <meshStandardMaterial color={bright} emissive={bot.accent} emissiveIntensity={0.9} toneMapped={false} />
            </mesh>
          </group>
        </group>
      </group>

      <Html position={[0, LABEL_Y, 0]} center zIndexRange={[30, 0]}>
        <button
          type="button"
          className="bot-badge"
          data-selected={selected || undefined}
          style={{ '--a': bot.accent } as React.CSSProperties}
          onClick={() => onSelect(bot.id)}
        >
          <StatusPill status={bot.status} floating />
          <span className="bot-badge__name">
            <RoleIcon className="bot-badge__role" size={12} strokeWidth={2.6} />
            {bot.name}
          </span>
        </button>
      </Html>
    </group>
  )
}
