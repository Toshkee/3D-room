import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { RoomPalette } from '../theme'
import { NODES, node, pathTo } from '../data/roam'
import type { World } from './world'

const GOALS = NODES.filter((n) => n.kind === 'mingle').map((n) => n.id)
// Stays on open floor: never routes over a seat, a desk chair or the doorway.
const allow = (id: string) => {
  const n = node(id)
  return n.sit == null && n.kind !== 'door'
}

// The lounge's robot vacuum — potters along the same walkway graph as the bots,
// pauses politely when one is in its way, and does a little spin at each stop.
export function Roomba({ p, world, reducedMotion }: { p: RoomPalette; world: World; reducedMotion: boolean }) {
  const root = useRef<THREE.Group>(null)
  const body = useRef<THREE.Group>(null)
  const led = useRef<THREE.Mesh>(null)
  const st = useRef({
    cur: 'm0',
    path: [] as string[],
    pi: 0,
    pos: new THREE.Vector3(node('m0').pos[0], 0, node('m0').pos[1]),
    yaw: 0,
    waitUntil: 0,
    spinUntil: 0,
  })

  useFrame(({ clock }, raw) => {
    const s = st.current
    const t = clock.elapsedTime
    const dt = Math.min(raw, 0.1)
    if (led.current) {
      const m = led.current.material as THREE.MeshStandardMaterial
      m.emissiveIntensity = (t * 1.2) % 1 < 0.5 ? 1.6 : 0.3
    }
    if (reducedMotion) return

    if (t < s.spinUntil) {
      s.yaw += dt * 3.2
    } else if (t < s.waitUntil) {
      // paused
    } else if (!s.path.length || s.pi >= s.path.length) {
      const options = GOALS.filter((g) => g !== s.cur)
      const goal = options[Math.floor(Math.random() * options.length)]
      s.path = pathTo(s.cur, goal, allow)
      s.pi = 0
      if (!s.path.length) s.waitUntil = t + 2
    } else {
      const [tx, tz] = node(s.path[s.pi]).pos
      const dx = tx - s.pos.x
      const dz = tz - s.pos.z
      const dist = Math.hypot(dx, dz)
      // Yield to any bot just ahead.
      let blocked = false
      for (const bp of Object.values(world.positions)) {
        const bx = bp.x - s.pos.x
        const bz = bp.z - s.pos.z
        const bd = Math.hypot(bx, bz)
        if (bd < 1.0 && (bx * dx + bz * dz) / (dist * bd + 1e-6) > 0.2) blocked = true
      }
      if (blocked) {
        s.waitUntil = t + 0.8
      } else if (dist < 0.08) {
        s.cur = s.path[s.pi]
        s.pi += 1
        if (s.pi >= s.path.length) {
          s.spinUntil = t + 1.9
          s.waitUntil = t + 3 + Math.random() * 4
        }
      } else {
        const step = Math.min(0.6 * dt, dist)
        s.pos.x += (dx / dist) * step
        s.pos.z += (dz / dist) * step
        const want = Math.atan2(dx, dz)
        s.yaw += Math.atan2(Math.sin(want - s.yaw), Math.cos(want - s.yaw)) * Math.min(1, dt * 6)
      }
    }
    if (root.current) root.current.position.set(s.pos.x, 0, s.pos.z)
    if (body.current) body.current.rotation.y = s.yaw
  })

  return (
    <group ref={root}>
      <group ref={body}>
        <mesh position={[0, 0.06, 0]}>
          <cylinderGeometry args={[0.3, 0.3, 0.1, 28]} />
          <meshStandardMaterial color={p.cabinetTop} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.115, 0]}>
          <cylinderGeometry args={[0.24, 0.26, 0.02, 28]} />
          <meshStandardMaterial color={p.cabinet} roughness={0.4} />
        </mesh>
        <mesh position={[0, 0.07, 0.24]} rotation-x={Math.PI / 2}>
          <boxGeometry args={[0.3, 0.04, 0.08]} />
          <meshStandardMaterial color="#1a1530" roughness={0.6} />
        </mesh>
        <mesh ref={led} position={[0, 0.13, 0.12]}>
          <sphereGeometry args={[0.03, 10, 8]} />
          <meshStandardMaterial color={p.neonC} emissive={p.neonC} emissiveIntensity={1.4} toneMapped={false} />
        </mesh>
      </group>
    </group>
  )
}
