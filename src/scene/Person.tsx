import { useEffect, useMemo, useRef, type MutableRefObject } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useGLTF, useAnimations, Billboard, Text } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'
import * as THREE from 'three'
import { HUMAN_URL, PALETTE } from '../theme'
import { useTapSelect } from '../useTapSelect'
import type { Project } from '../data/projects'
import {
  AMBIENT,
  chooseGoal,
  nodeById,
  pathFromDeskTo,
  pathLength,
  pathTo,
  STAGE_NODES,
  type AmbientNode,
  type Occupancy,
} from '../data/ambient'

useGLTF.preload(HUMAN_URL)

// The Soldier renders ~1.85m tall at scale 1 with feet at y=0 (Box3 auto-fit is
// unreliable on this skinned mesh, so these are fixed + verified visually).
const TARGET_HEIGHT = 1.85 // nameplate height reference
const HUMAN_SCALE = 1
const HUMAN_FOOT_Y = 0
const REST_EMISSIVE = 0.0
const ACTIVE_EMISSIVE = 0.5

/** Shortest-path angular damp (handles wrap-around). */
function dampAngle(cur: number, target: number, lambda: number, dt: number) {
  let d = target - cur
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return cur + d * (1 - Math.exp(-lambda * dt))
}

const randRange = ([lo, hi]: readonly [number, number]) => lo + Math.random() * (hi - lo)

type Clip = 'Idle' | 'Walk' | 'Run'
type Phase = 'ENTER' | 'DWELL' | 'TRAVEL'

type Props = {
  project: Project
  /** Where the person settles after walking in (the start of its roaming). */
  home: [number, number]
  /** Facing once settled at home. */
  faceY: number
  /** Where the person enters from. */
  entrance: [number, number]
  /** Stagger (seconds) before this person starts walking in. */
  delay: number
  /** True while the intro walk-in should play; false = place at home, idling. */
  playing: boolean
  reduced: boolean
  selected: boolean
  /** The globally-selected gamer's id (so neighbors yield to it), or null. */
  selectedId: string | null
  /** Once true (intro over), autonomous roaming is allowed to start. */
  introDone: boolean
  phase: number
  onSelect: (id: string) => void
  /** Shared live floor positions (id → Vector3), for camera-follow + separation. */
  positions: MutableRefObject<Record<string, THREE.Vector3>>
  /** Shared node/corridor reservations so two gamers never share a spot. */
  occupancy: MutableRefObject<Occupancy>
}

/**
 * A realistic gamer: a clone of the rigged Soldier ("Vanguard") humanoid, tinted
 * to the project accent. It walks in from the entrance on load, then roams the
 * lounge on its own — milling, pairing up to chat, drifting to the wall screen to
 * watch, or heading back to a workstation — via a small DWELL↔TRAVEL state machine
 * over a shared waypoint graph (`data/ambient.ts`). Selecting it makes it come to
 * attention (face the camera) until deselected. The whole group is the click
 * target; an accent floor ring + the bot's own glow show hover/selection.
 */
export function Person({
  project,
  home,
  faceY,
  entrance,
  delay,
  playing,
  reduced,
  selected,
  selectedId,
  introDone,
  phase,
  onSelect,
  positions,
  occupancy,
}: Props) {
  const { id, name, hex, css } = project
  const { scene, animations } = useGLTF(HUMAN_URL)
  const group = useRef<THREE.Group>(null)
  const invalidate = useThree((s) => s.invalidate)
  const camera = useThree((s) => s.camera)
  const { hovered, handlers } = useTapSelect(id, onSelect)
  const active = hovered || selected

  const bodyMats = useRef<THREE.MeshStandardMaterial[]>([])
  const ringMat = useRef<THREE.MeshStandardMaterial>(null)

  // Independent skinned clone + accent tint.
  const clone = useMemo(() => {
    const c = SkeletonUtils.clone(scene)
    const mats: THREE.MeshStandardMaterial[] = []
    c.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.frustumCulled = false // skinned + moving: avoid bad-cull disappearing
      const mat = mesh.material as THREE.MeshStandardMaterial
      if (mat?.isMaterial && /body/i.test(mat.name)) {
        const m = mat.clone()
        // Tint toward the accent while keeping the texture detail (team colors).
        m.color = new THREE.Color(hex).lerp(new THREE.Color('#ffffff'), 0.18)
        m.emissive = new THREE.Color(hex)
        m.emissiveIntensity = REST_EMISSIVE
        m.metalness = 0.0
        m.roughness = 0.75
        mesh.material = m
        mats.push(m)
      }
    })
    bodyMats.current = mats
    return c
  }, [scene, hex])

  const { actions } = useAnimations(animations, group)

  // ---- animation + behavior state ----
  const clip = useRef<Clip>('Idle')
  const startedAt = useRef<number | null>(null)
  const glow = useRef(REST_EMISSIVE)

  const stPhase = useRef<Phase>('ENTER')
  const dwellUntil = useRef(0)
  const path = useRef<[number, number][]>([])
  const goalNode = useRef<AmbientNode | null>(null)
  const goalFaceY = useRef(faceY)
  const partnerId = useRef<string | null>(null) // partner CHAT node id (not an agent id)
  const partnerPos = useRef<[number, number] | null>(null)
  const currentNodeId = useRef<string | null>(null)
  const corridor = useRef<'L' | 'R' | null>(null)
  const deskNode = useRef<AmbientNode | null>(null)
  const running = useRef(false)
  // periodic "glance at a neighbor" while milling
  const gazeUntil = useRef(0)
  const gazeCooldown = useRef(0)
  const gazeTargetId = useRef<string | null>(null)

  const setClip = (to: Clip, fade = 0.25) => {
    if (clip.current === to) return
    const from = actions[clip.current]
    const next = actions[to]
    if (next) next.reset().fadeIn(fade).play()
    if (from) from.fadeOut(fade)
    clip.current = to
  }

  const writePos = (x: number, z: number) => {
    let v = positions.current[id]
    if (!v) {
      v = new THREE.Vector3()
      positions.current[id] = v
    }
    v.set(x, 0, z)
  }

  // Initial placement + (reduced) static pose.
  useEffect(() => {
    const g = group.current
    if (!g) return
    // This effect re-runs on a live prefers-reduced-motion toggle (no remount, so
    // the unmount cleanup doesn't fire) — release any held reservations + clear
    // routing state first, or we'd leak a node/corridor and resume with a stale
    // desk-return path that cuts through furniture.
    const occ = occupancy.current
    for (const k of Object.keys(occ.nodes)) if (occ.nodes[k] === id) occ.nodes[k] = undefined
    if (occ.corridors.L === id) occ.corridors.L = null
    if (occ.corridors.R === id) occ.corridors.R = null
    corridor.current = null
    deskNode.current = null
    currentNodeId.current = null
    goalNode.current = null
    path.current = []
    partnerId.current = null
    partnerPos.current = null
    const idle = actions.Idle
    if (reduced || !playing) {
      g.position.set(home[0], 0, home[1])
      g.rotation.y = faceY
      stPhase.current = 'DWELL'
      dwellUntil.current = Infinity // reduced: never roams
      startedAt.current = null
      clip.current = 'Idle'
      if (idle) {
        idle.reset().play()
        if (reduced) {
          // Freeze a standing frame (bind pose is a T-pose otherwise).
          idle.time = 0.6
          idle.getMixer().update(0)
          idle.paused = true
        }
      }
    } else {
      // Spawn at the entrance, facing toward home, idling until the cue.
      g.position.set(entrance[0], 0, entrance[1])
      g.rotation.y = Math.atan2(home[0] - entrance[0], home[1] - entrance[1])
      stPhase.current = 'ENTER'
      startedAt.current = null
      clip.current = 'Idle'
      idle?.reset().play()
    }
    writePos(g.position.x, g.position.z)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reduced, playing, actions])

  // Release this gamer's reservations if it ever unmounts.
  useEffect(() => {
    return () => {
      const occ = occupancy.current
      for (const k of Object.keys(occ.nodes)) if (occ.nodes[k] === id) occ.nodes[k] = undefined
      if (occ.corridors.L === id) occ.corridors.L = null
      if (occ.corridors.R === id) occ.corridors.R = null
      delete positions.current[id]
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Pick a destination and lay out the path to it (mutates shared occupancy).
  const pickGoal = (now: number) => {
    const g = group.current!
    const occ = occupancy.current
    // free the node I'm leaving
    if (currentNodeId.current && occ.nodes[currentNodeId.current] === id)
      occ.nodes[currentNodeId.current] = undefined
    const onDesk = corridor.current !== null
    const goal = chooseGoal(occ, currentNodeId.current, onDesk, id)
    if (!goal) {
      dwellUntil.current = now + 2 // everything busy; try again shortly
      return
    }
    occ.nodes[goal.id] = id
    goalNode.current = goal
    let pts: [number, number][]
    if (onDesk) {
      // returning from a workstation back out to the stage
      pts = pathFromDeskTo(deskNode.current!, goal)
    } else if (goal.flavor === 'DESK') {
      const side = goal.pos[0] < 0 ? 'L' : 'R'
      occ.corridors[side] = id
      corridor.current = side
      deskNode.current = goal
      pts = pathTo(goal)
    } else {
      pts = [goal.pos]
    }
    path.current = pts
    running.current = pathLength(g.position, pts) > AMBIENT.RUN_LEN || Math.random() < AMBIENT.RUN_DICE
    currentNodeId.current = null
    stPhase.current = 'TRAVEL'
  }

  const arriveAtGoal = (now: number) => {
    const goal = goalNode.current
    setClip('Idle')
    currentNodeId.current = goal?.id ?? null
    // back on the stage after a desk run → release the corridor
    if (corridor.current && goal && goal.flavor !== 'DESK') {
      const occ = occupancy.current
      if (occ.corridors[corridor.current] === id) occ.corridors[corridor.current] = null
      corridor.current = null
      deskNode.current = null
    }
    goalFaceY.current = goal?.faceY ?? faceY
    partnerId.current = goal?.partner ?? null
    partnerPos.current = goal?.partner ? nodeById(goal.partner)?.pos ?? null : null
    dwellUntil.current = now + randRange(AMBIENT.dwell[goal?.flavor ?? 'MILL'])
    stPhase.current = 'DWELL'
  }

  // Hard anti-overlap: guarantees no two bodies interpenetrate (a soft velocity
  // nudge can't — separation at SEP_CAP m/s loses to a head-on cross at WALK_SPEED).
  // Yield rule keeps it stable + protects the focused gamer: the *selected* gamer
  // never moves (passers-by go around it); otherwise the higher-id of the pair
  // yields. So exactly one agent of each close pair steps out to BODY_SEP, radially.
  // Front-stage only — corridors/desks are single-occupant by reservation, and the
  // stage is furniture-free so a sideways step stays clear.
  const avoidOverlap = (g: THREE.Group) => {
    if (selected) return // the focused gamer holds its spot
    const reg = positions.current
    for (const oid in reg) {
      if (oid === id) continue
      // yield to the selected gamer always; else only the higher id yields
      if (!(oid === selectedId || id > oid)) continue
      const v = reg[oid]
      const dx = g.position.x - v.x
      const dz = g.position.z - v.z
      const d = Math.hypot(dx, dz)
      if (d > 1e-4 && d < AMBIENT.BODY_SEP) {
        const f = (AMBIENT.BODY_SEP - d) / d
        g.position.x += dx * f
        g.position.z += dz * f
      }
    }
  }

  const yawToward = (g: THREE.Group, tx: number, tz: number) =>
    Math.atan2(tx - g.position.x, tz - g.position.z)

  // nearest other gamer (for the milling glance)
  const nearestOther = (g: THREE.Group): string | null => {
    let best: string | null = null
    let bestD = Infinity
    const reg = positions.current
    for (const oid in reg) {
      if (oid === id) continue
      const v = reg[oid]
      const d = (v.x - g.position.x) ** 2 + (v.z - g.position.z) ** 2
      if (d < bestD) {
        bestD = d
        best = oid
      }
    }
    return best
  }

  useFrame((state, rawDelta) => {
    // R3F doesn't clamp delta; after a tab-refocus the first frame's delta is the
    // whole hidden duration (multi-second). Cap it so delta-scaled motion (esp.
    // the velocity-capped separation nudge) can't teleport in one frame. Dwell
    // timers key off clock.elapsedTime, not delta, so they're unaffected.
    const delta = Math.min(rawDelta, 0.1)
    const g = group.current
    // publish live position first (read by the camera rig + neighbors)
    if (g) writePos(g.position.x, g.position.z)

    // accent glow ramp (also under reduced/demand)
    const target = active ? ACTIVE_EMISSIVE : REST_EMISSIVE
    glow.current = THREE.MathUtils.lerp(glow.current, target, reduced ? 1 : 0.12)
    for (const m of bodyMats.current) m.emissiveIntensity = glow.current
    if (ringMat.current) ringMat.current.emissiveIntensity = 0.45 + glow.current * 2.2
    if (reduced) {
      if (Math.abs(glow.current - target) > 1e-3) invalidate()
      return
    }
    if (!g || !playing) return

    const now = state.clock.elapsedTime

    // ---- ENTER: the staggered walk-in from the entrance ----
    if (stPhase.current === 'ENTER') {
      if (startedAt.current === null) startedAt.current = now
      const t = now - startedAt.current
      if (t < delay) {
        setClip('Idle')
        return
      }
      setClip('Walk')
      const dx = home[0] - g.position.x
      const dz = home[1] - g.position.z
      const dist = Math.hypot(dx, dz)
      if (dist < 0.08) {
        g.position.set(home[0], 0, home[1])
        setClip('Idle')
        goalFaceY.current = faceY
        // Reserve the stage node this home sits on (several CAST homes coincide
        // with a MILL/CHAT node) so a roamer's chooseGoal won't claim the spot we
        // just settled on and walk onto us — especially while we're selected
        // (selected gamers never re-pick, so they'd otherwise stay unreserved).
        const occ = occupancy.current
        let bestId: string | null = null
        let bestD: number = AMBIENT.SEP_DIST
        for (const n of STAGE_NODES) {
          if (occ.nodes[n.id] !== undefined && occ.nodes[n.id] !== id) continue
          const d = Math.hypot(n.pos[0] - home[0], n.pos[1] - home[1])
          if (d < bestD) {
            bestD = d
            bestId = n.id
          }
        }
        if (bestId) occ.nodes[bestId] = id
        currentNodeId.current = bestId // freed on the next pickGoal; goalNode stays null → mills/glances
        dwellUntil.current = now + randRange(AMBIENT.dwell.MILL)
        stPhase.current = 'DWELL'
      } else {
        const ux = dx / dist
        const uz = dz / dist
        const step = Math.min(AMBIENT.WALK_SPEED * delta, dist)
        g.position.x += ux * step
        g.position.z += uz * step
        g.rotation.y = dampAngle(g.rotation.y, Math.atan2(ux, uz), 10, delta)
        avoidOverlap(g) // keep the entering crowd from clipping (entrance is front-stage)
      }
      return
    }

    // ---- TRAVEL: follow the current path ----
    if (stPhase.current === 'TRAVEL') {
      setClip(running.current ? 'Run' : 'Walk')
      const tgt = path.current[0]
      if (!tgt) {
        arriveAtGoal(now)
        return
      }
      const dx = tgt[0] - g.position.x
      const dz = tgt[1] - g.position.z
      const dist = Math.hypot(dx, dz)
      const speed = running.current ? AMBIENT.RUN_SPEED : AMBIENT.WALK_SPEED
      if (dist < AMBIENT.ARRIVE) {
        g.position.set(tgt[0], 0, tgt[1])
        path.current = path.current.slice(1)
        if (path.current.length === 0) arriveAtGoal(now)
      } else {
        const ux = dx / dist
        const uz = dz / dist
        const step = Math.min(speed * delta, dist)
        g.position.x += ux * step
        g.position.z += uz * step
        g.rotation.y = dampAngle(g.rotation.y, Math.atan2(ux, uz), 10, delta)
      }
      if (g.position.z >= -0.5) avoidOverlap(g)
      g.position.x = THREE.MathUtils.clamp(g.position.x, -AMBIENT.CLAMP_X, AMBIENT.CLAMP_X)
      g.position.z = THREE.MathUtils.clamp(g.position.z, -AMBIENT.CLAMP_Z, AMBIENT.CLAMP_Z)
      return
    }

    // ---- DWELL: standing at a spot, choosing where to go next ----
    setClip('Idle')
    const flavor = goalNode.current?.flavor ?? 'MILL'

    // facing target
    let targetYaw = goalFaceY.current
    if (selected) {
      // come to attention: face the camera
      targetYaw = yawToward(g, camera.position.x, camera.position.z)
    } else if (partnerId.current) {
      // face the gamer who took the partner slot; else face the empty slot
      const partnerAgent = occupancy.current.nodes[partnerId.current]
      const pv = partnerAgent ? positions.current[partnerAgent] : undefined
      if (pv) targetYaw = yawToward(g, pv.x, pv.z)
      else if (partnerPos.current) targetYaw = yawToward(g, partnerPos.current[0], partnerPos.current[1])
    } else if (flavor === 'MILL') {
      // glance at a neighbor every several seconds
      if (now >= gazeCooldown.current && now >= gazeUntil.current) {
        gazeUntil.current = now + 1.8
        gazeCooldown.current = now + 6 + Math.random() * 4
        gazeTargetId.current = nearestOther(g)
      }
      if (now < gazeUntil.current && gazeTargetId.current) {
        const gv = positions.current[gazeTargetId.current]
        if (gv) targetYaw = yawToward(g, gv.x, gv.z)
      }
    }
    const sway = Math.sin(now * 0.5 + phase) * 0.03
    g.rotation.y = dampAngle(g.rotation.y, targetYaw + sway, selected ? 5 : 2.4, delta)
    // hold our spot if selected (focused); else yield to anyone passing through us
    if (g.position.z >= -0.5) avoidOverlap(g)

    // pick the next destination once the dwell elapses (not while selected)
    if (introDone && !selected && now > dwellUntil.current) pickGoal(now)
  })

  return (
    <group ref={group}>
      {/* accent floor ring (visible now that gamers stand in the open) */}
      <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.34, 0.46, 40]} />
        <meshStandardMaterial
          ref={ringMat}
          color={hex}
          emissive={hex}
          emissiveIntensity={0.45}
          toneMapped={false}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* the human (fixed scale; feet grounded via HUMAN_FOOT_Y) */}
      <group scale={HUMAN_SCALE} position={[0, HUMAN_FOOT_Y, 0]}>
        <primitive object={clone} />
      </group>

      {/* nameplate */}
      <Billboard position={[0, TARGET_HEIGHT + 0.4, 0]}>
        <Text
          fontSize={0.18}
          color={active ? css : PALETTE.ink}
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.03}
          outlineWidth={0.014}
          outlineColor={'#05040a'}
          fillOpacity={active ? 1 : 0.8}
        >
          {name}
        </Text>
      </Billboard>

      {/* invisible click/hover target */}
      <mesh position={[0, 1.0, 0]} {...handlers}>
        <boxGeometry args={[0.9, 2.0, 0.9]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}
