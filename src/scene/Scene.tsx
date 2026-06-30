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
import { GamingStation } from './GamingStation'
import { Effects } from './Effects'
import { PROJECTS } from '../data/projects'
import { STATIONS } from '../data/stations'
import { usePrefersReducedMotion } from '../usePrefersReducedMotion'
import { LOW_POWER } from '../lowPower'

type SceneProps = {
  selectedId: string | null
  onSelect: (id: string) => void
  /** Fired once the scene (incl. async model + HDRI) has mounted. */
  onReady: () => void
}

type Controls = ComponentRef<typeof OrbitControls>

/** Eases the orbit pivot toward the selected gamer (and back to the center). */
function CameraRig({
  controls,
  focus,
}: {
  controls: RefObject<Controls | null>
  focus: [number, number] | null
}) {
  const invalidate = useThree((s) => s.invalidate)
  useFrame((_, delta) => {
    const c = controls.current
    if (!c) return
    const tx = focus ? focus[0] : 0
    const ty = focus ? 1.25 : 1.05
    const tz = focus ? focus[1] : -0.8
    const k = 3.2
    c.target.x = THREE.MathUtils.damp(c.target.x, tx, k, delta)
    c.target.y = THREE.MathUtils.damp(c.target.y, ty, k, delta)
    c.target.z = THREE.MathUtils.damp(c.target.z, tz, k, delta)
    if (
      Math.abs(c.target.x - tx) > 1e-3 ||
      Math.abs(c.target.y - ty) > 1e-3 ||
      Math.abs(c.target.z - tz) > 1e-3
    )
      invalidate()
  })
  return null
}

/**
 * The whole gaming lounge: lights, the room shell, the lounge, one gaming
 * station per project, orbit controls (idle drift + focus-on-select), and the
 * post-processing pass.
 */
export function Scene({ selectedId, onSelect, onReady }: SceneProps) {
  const reducedMotion = usePrefersReducedMotion()
  const controls = useRef<Controls>(null)
  const [interacting, setInteracting] = useState(false)

  // This effect only runs once the whole Suspense subtree (model + HDRI) is
  // resolved and committed, so it's a reliable "scene is ready" signal.
  useEffect(() => onReady(), [onReady])

  const selIndex = PROJECTS.findIndex((p) => p.id === selectedId)
  const focus = selIndex >= 0 ? STATIONS[selIndex].pos : null

  return (
    <>
      <Lighting />
      <Room />
      <WallDressing />
      <Lounge />
      <FoodDrinks />
      <Decor />

      {PROJECTS.map((project, i) => {
        const station = STATIONS[i]
        if (!station) return null
        return (
          <GamingStation
            key={project.id}
            project={project}
            position={station.pos}
            faceY={station.faceY}
            selected={selectedId === project.id}
            reduced={reducedMotion}
            phase={i * 1.7}
            onSelect={onSelect}
          />
        )
      })}

      {/* soft grounded contact shadows (cheap ambient-occlusion-like darkening) */}
      <ContactShadows
        position={[0, 0.015, 0]}
        scale={22}
        resolution={LOW_POWER ? 512 : 1024}
        blur={2.6}
        opacity={0.5}
        far={6}
        frames={LOW_POWER ? 1 : Infinity}
      />

      <OrbitControls
        ref={controls}
        makeDefault
        enablePan={false}
        enableDamping
        dampingFactor={0.08}
        rotateSpeed={0.7}
        zoomSpeed={0.8}
        minDistance={5}
        maxDistance={24}
        target={[0, 1.05, -0.8]}
        autoRotate={!reducedMotion && !interacting && !selectedId}
        autoRotateSpeed={0.32}
        onStart={() => setInteracting(true)}
        onEnd={() => setInteracting(false)}
        // Stay inside the room: never below the floor, never fully top-down.
        minPolarAngle={Math.PI / 6}
        maxPolarAngle={Math.PI / 2.15}
        // Don't let the camera swing behind the open front wall into the walls.
        minAzimuthAngle={-Math.PI / 2.1}
        maxAzimuthAngle={Math.PI / 2.1}
        mouseButtons={{
          LEFT: THREE.MOUSE.ROTATE,
          MIDDLE: THREE.MOUSE.DOLLY,
          RIGHT: THREE.MOUSE.ROTATE,
        }}
        touches={{ ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_PAN }}
      />
      <CameraRig controls={controls} focus={focus} />

      <Effects />
    </>
  )
}
