import { useEffect, useRef, useState, type ComponentRef, type RefObject } from 'react'
import { OrbitControls, ContactShadows } from '@react-three/drei'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Lighting } from './Lighting'
import { Room } from './Room'
import { Lounge } from './Lounge'
import { FoodDrinks } from './FoodDrinks'
import { Decor } from './Decor'
import { WallDressing } from './WallDressing'
import { Battlestation } from './Battlestation'
import { Person } from './Person'
import { Effects } from './Effects'
import { PROJECTS } from '../data/projects'
import { DESKS, CAST, ENTRANCE, RESERVED_POS } from '../data/stations'
import type { Occupancy } from '../data/ambient'
import { usePrefersReducedMotion } from '../usePrefersReducedMotion'
import { LOW_POWER } from '../lowPower'

type SceneProps = {
  selectedId: string | null
  onSelect: (id: string) => void
  /** Fired once the scene (incl. async models + HDRI) has mounted. */
  onReady: () => void
}

type Controls = ComponentRef<typeof OrbitControls>

// Resting camera pose — also the home target the focus rig eases back to.
const REST_TARGET: [number, number, number] = [0, 1.2, -1.0]
const REST_POS: [number, number, number] = [0, 7.8, 18]
// Cinematic open: a low 3/4 angle on the entering crowd, craning up to the rest.
const INTRO_POS: [number, number, number] = [4.0, 1.9, 11.5]
const INTRO_TARGET: [number, number, number] = [0, 1.45, 3.2]
const INTRO_DURATION = 6.2

const smoothstep = (t: number) => t * t * (3 - 2 * t)

/**
 * Eases the orbit pivot toward the selected gamer (and back to the center). The
 * gamers roam, so the focus is read *live* from the shared positions registry
 * each frame — the pivot tracks a walking target. Faster damping while the
 * followed gamer is actually moving so the camera keeps up without whipping.
 */
function CameraRig({
  controls,
  positions,
  selectedId,
  enabled,
}: {
  controls: RefObject<Controls | null>
  positions: RefObject<Record<string, THREE.Vector3>>
  selectedId: string | null
  enabled: boolean
}) {
  const invalidate = useThree((s) => s.invalidate)
  const last = useRef(new THREE.Vector3())
  useFrame((_, rawDelta) => {
    const c = controls.current
    if (!c || !enabled) return
    const delta = Math.min(rawDelta, 0.1) // avoid a camera snap on tab-refocus delta spikes
    let tx = REST_TARGET[0]
    let ty = REST_TARGET[1]
    let tz = REST_TARGET[2]
    let moving = false
    if (selectedId) {
      const v = positions.current[selectedId]
      if (v) {
        tx = v.x
        ty = 1.35
        tz = v.z
        moving = v.distanceToSquared(last.current) > 1e-5
        last.current.copy(v)
      } else {
        // the reserved add-slot has no roaming gamer — focus its desk
        tx = RESERVED_POS[0]
        ty = 1.35
        tz = RESERVED_POS[1]
      }
    }
    const k = moving ? 4.5 : 3.2
    c.target.x = THREE.MathUtils.damp(c.target.x, tx, k, delta)
    c.target.y = THREE.MathUtils.damp(c.target.y, ty, k, delta)
    c.target.z = THREE.MathUtils.damp(c.target.z, tz, k, delta)
    if (
      moving ||
      Math.abs(c.target.x - tx) > 1e-3 ||
      Math.abs(c.target.y - ty) > 1e-3 ||
      Math.abs(c.target.z - tz) > 1e-3
    )
      invalidate()
  })
  return null
}

/**
 * The cinematic open. While active, OrbitControls is *unmounted* (drei otherwise
 * calls controls.update() every frame for damping, which would fight us for the
 * camera), so IntroCamera fully owns it: a crane from a low angle on the entering
 * crowd up to the resting overview, then it hands off. User input skips it.
 */
function IntroCamera({ active, onDone }: { active: boolean; onDone: () => void }) {
  const camera = useThree((s) => s.camera)
  const startT = useRef<number | null>(null)
  const done = useRef(false)
  const tmpPos = useRef(new THREE.Vector3())
  const tmpTgt = useRef(new THREE.Vector3())

  const finish = () => {
    if (done.current) return
    done.current = true
    camera.position.set(...REST_POS)
    camera.lookAt(...REST_TARGET)
    onDone()
  }

  // Skip on any user input.
  useEffect(() => {
    if (!active) return
    const skip = () => finish()
    window.addEventListener('pointerdown', skip)
    window.addEventListener('wheel', skip, { passive: true })
    window.addEventListener('keydown', skip)
    window.addEventListener('touchstart', skip, { passive: true })
    return () => {
      window.removeEventListener('pointerdown', skip)
      window.removeEventListener('wheel', skip)
      window.removeEventListener('keydown', skip)
      window.removeEventListener('touchstart', skip)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active])

  useFrame((state) => {
    if (!active || done.current) return
    if (startT.current === null) startT.current = state.clock.elapsedTime
    const t = (state.clock.elapsedTime - startT.current) / INTRO_DURATION
    if (t >= 1) {
      finish()
      return
    }
    const k = smoothstep(t)
    tmpPos.current.set(...INTRO_POS).lerp(new THREE.Vector3(...REST_POS), k)
    tmpTgt.current.set(...INTRO_TARGET).lerp(new THREE.Vector3(...REST_TARGET), k)
    camera.position.copy(tmpPos.current)
    camera.lookAt(tmpTgt.current)
  })

  return null
}

/**
 * The whole gaming lounge: lights, the room shell, the lounge + arena furniture,
 * the gamers (who walk in and settle), orbit controls (cinematic open, then idle
 * drift + focus-on-select), and the post-processing pass.
 */
export function Scene({ selectedId, onSelect, onReady }: SceneProps) {
  const reducedMotion = usePrefersReducedMotion()
  const controls = useRef<Controls>(null)
  const [interacting, setInteracting] = useState(false)
  // No cinematic open under reduced motion — start settled.
  const [intro, setIntro] = useState(!reducedMotion)

  // Shared, mutated-in-place state for the roaming gamers: live floor positions
  // (camera-follow + neighbor separation) and node/corridor reservations (so two
  // gamers never pick the same spot or corridor).
  const positions = useRef<Record<string, THREE.Vector3>>({})
  const occupancy = useRef<Occupancy>({ nodes: {}, corridors: { L: null, R: null } })

  useEffect(() => onReady(), [onReady])

  return (
    <>
      <Lighting />
      <Room />
      <WallDressing />
      <Lounge />
      <FoodDrinks />
      <Decor />

      {/* arena battlestations (set dressing; the reserved one is selectable) */}
      {DESKS.map((d, i) => (
        <Battlestation
          key={i}
          position={d.pos}
          faceY={d.faceY}
          hex={d.hex}
          reserved={d.reserved}
          selected={d.reserved ? selectedId === 'add-slot' : undefined}
          reduced={reducedMotion}
          onSelect={d.reserved ? onSelect : undefined}
        />
      ))}

      {/* the gamers — they walk in from the entrance and settle facing the camera */}
      {PROJECTS.map((project, i) => {
        const spot = CAST[i]
        if (!spot) return null
        return (
          <Person
            key={project.id}
            project={project}
            home={spot.home}
            faceY={spot.faceY}
            entrance={[ENTRANCE[0] + (i - 4) * 0.55, ENTRANCE[1]]}
            delay={spot.delay}
            playing={!reducedMotion}
            reduced={reducedMotion}
            selected={selectedId === project.id}
            selectedId={selectedId}
            introDone={!intro}
            phase={i * 1.7}
            onSelect={onSelect}
            positions={positions}
            occupancy={occupancy}
          />
        )
      })}

      {/* soft grounded contact shadows (cheap ambient-occlusion-like darkening) */}
      <ContactShadows
        position={[0, 0.015, 0]}
        scale={26}
        resolution={LOW_POWER ? 512 : 1024}
        blur={2.6}
        opacity={0.5}
        far={7}
        frames={LOW_POWER ? 1 : Infinity}
      />

      {/* Mounted only after the cinematic open — drei's per-frame damping update
          would otherwise wrestle the camera away from IntroCamera. */}
      {!intro && (
        <OrbitControls
          ref={controls}
          makeDefault
          enablePan={false}
          enableDamping
          dampingFactor={0.08}
          rotateSpeed={0.7}
          zoomSpeed={0.8}
          minDistance={6}
          maxDistance={30}
          target={REST_TARGET}
          autoRotate={!reducedMotion && !interacting && !selectedId}
          autoRotateSpeed={0.32}
          onStart={() => setInteracting(true)}
          onEnd={() => setInteracting(false)}
          minPolarAngle={Math.PI / 6}
          maxPolarAngle={Math.PI / 2.15}
          minAzimuthAngle={-Math.PI / 2.1}
          maxAzimuthAngle={Math.PI / 2.1}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.DOLLY,
            RIGHT: THREE.MOUSE.ROTATE,
          }}
          touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
        />
      )}
      <CameraRig controls={controls} positions={positions} selectedId={selectedId} enabled={!intro} />
      <IntroCamera active={intro} onDone={() => setIntro(false)} />

      <Effects />
    </>
  )
}
