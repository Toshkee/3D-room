import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { clamp } from '../util'

const HOME = new THREE.Vector3(0, 1.7, 0)
const lerp = THREE.MathUtils.lerp
// Keep the camera on the open side of the room (walls are at −x and −z), so
// neither dragging nor the idle auto-orbit ever ends up behind a wall.
const AZ_MIN = 0.1
const AZ_MAX = Math.PI / 2 - 0.1

// Minimal shape of the drei/three OrbitControls we drive.
type Ctl = {
  target: THREE.Vector3
  autoRotate: boolean
  autoRotateSpeed: number
  getAzimuthalAngle(): number
  addEventListener(type: string, cb: () => void): void
  removeEventListener(type: string, cb: () => void): void
}

// Cinematic camera: a crane-in intro on load, then OrbitControls with two
// behaviors layered on — "fly to" and track the selected bot as it roams, and a
// gentle idle auto-orbit when you're not touching it. On a portrait screen the
// whole room is a sliver, so with nothing selected it frames the bots instead.
// Your own zoom is left alone until you've stopped touching the camera for a
// while (or pick another bot). Under reduced motion the intro + auto-orbit are
// skipped (it starts settled).
export function CameraRig({
  selectedId,
  positions,
  reducedMotion,
}: {
  selectedId: string | null
  positions: { current: Record<string, THREE.Vector3> }
  reducedMotion: boolean
}) {
  const { size } = useThree()
  const homeZoom = clamp(Math.min(size.width, size.height * 1.4) / 18, 16, 120)
  const portrait = size.width / size.height < 0.8
  const [introDone, setIntroDone] = useState(reducedMotion)

  if (!introDone) {
    return <IntroCam homeZoom={homeZoom} onDone={() => setIntroDone(true)} />
  }
  return (
    <>
      <OrbitControls
        makeDefault
        target={[0, 1.7, 0]}
        enablePan={false}
        enableDamping
        dampingFactor={0.09}
        rotateSpeed={0.6}
        zoomSpeed={0.9}
        minZoom={16}
        maxZoom={150}
        minPolarAngle={Math.PI * 0.12}
        maxPolarAngle={Math.PI * 0.47}
        minAzimuthAngle={AZ_MIN}
        maxAzimuthAngle={AZ_MAX}
      />
      <Director
        selectedId={selectedId}
        positions={positions}
        reducedMotion={reducedMotion}
        homeZoom={homeZoom}
        portrait={portrait}
      />
    </>
  )
}

function IntroCam({ homeZoom, onDone }: { homeZoom: number; onDone: () => void }) {
  const { camera, invalidate, gl } = useThree()
  const el = useRef(0)
  const done = useRef(false)
  const DUR = 2.6

  const finish = () => {
    if (done.current) return
    done.current = true
    onDone()
  }

  // Any interaction skips the intro.
  useEffect(() => {
    const dom = gl.domElement
    const skip = () => finish()
    dom.addEventListener('pointerdown', skip)
    dom.addEventListener('wheel', skip, { passive: true })
    return () => {
      dom.removeEventListener('pointerdown', skip)
      dom.removeEventListener('wheel', skip)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useFrame((_, dt) => {
    if (done.current) return
    el.current += Math.min(dt, 0.05)
    const t = Math.min(el.current / DUR, 1)
    const e = 1 - Math.pow(1 - t, 3) // easeOutCubic
    const cam = camera as THREE.OrthographicCamera
    cam.position.set(lerp(3, 17, e), lerp(3.2, 14, e), lerp(15, 17, e))
    cam.zoom = lerp(homeZoom * 1.55, homeZoom, e)
    cam.lookAt(0, lerp(2.0, 1.7, e), 0)
    cam.updateProjectionMatrix()
    invalidate()
    if (t >= 1) finish()
  })

  return null
}

/** Seconds after you last touched the camera before it re-frames on its own. */
const HANDS_OFF = 8
/** Screen-pixel margins kept around framed bots (name tags sit above them). */
const FRAME_X = 56
const FRAME_TOP = 120
const FRAME_BOTTOM = 70

function Director({
  selectedId,
  positions,
  reducedMotion,
  homeZoom,
  portrait,
}: {
  selectedId: string | null
  positions: { current: Record<string, THREE.Vector3> }
  reducedMotion: boolean
  homeZoom: number
  portrait: boolean
}) {
  const { camera, invalidate, size } = useThree()
  const controls = useThree((s) => s.controls) as unknown as Ctl | null
  const lastInteract = useRef(0)
  const userAt = useRef(-Infinity)
  const flyUntil = useRef(0)
  const prevSel = useRef<string | null>(null)
  const bump = useRef(false)
  const swing = useRef(1)
  const focus = useMemo(() => new THREE.Vector3(), [])
  const right = useMemo(() => new THREE.Vector3(), [])
  const up = useMemo(() => new THREE.Vector3(), [])
  const d = useMemo(() => new THREE.Vector3(), [])

  useEffect(() => {
    if (!controls) return
    const onStart = () => {
      bump.current = true
    }
    controls.addEventListener('start', onStart)
    return () => controls.removeEventListener('start', onStart)
  }, [controls])

  useFrame(({ clock }) => {
    if (!controls) return
    const now = clock.elapsedTime
    if (bump.current) {
      lastInteract.current = now
      userAt.current = now
      bump.current = false
    }
    if (selectedId !== prevSel.current) {
      // Picking (or dropping) a bot is a deliberate camera move.
      prevSel.current = selectedId
      flyUntil.current = now + 2.5
    }
    const cam = camera as THREE.OrthographicCamera
    const sel = selectedId ? positions.current[selectedId] : undefined
    const bots = Object.values(positions.current)

    let desiredZoom = homeZoom
    if (sel) {
      focus.set(sel.x, 1.0, sel.z)
      controls.target.lerp(focus, 0.09)
      desiredZoom = clamp(homeZoom * 1.7, 16, 150)
      controls.autoRotate = false
      lastInteract.current = now
    } else {
      if (portrait && bots.length) {
        // Center on the bots and zoom so all of them (and their tags) fit.
        focus.set(0, 1.0, 0)
        for (const p of bots) focus.add(d.set(p.x / bots.length, 0, p.z / bots.length))
        controls.target.lerp(focus, 0.04)
        right.setFromMatrixColumn(cam.matrixWorld, 0)
        up.setFromMatrixColumn(cam.matrixWorld, 1)
        let fit = homeZoom * 2.2
        for (const p of bots) {
          d.set(p.x, 0, p.z).sub(controls.target)
          const x = Math.abs(d.dot(right))
          const y = d.dot(up)
          if (x > 0.01) fit = Math.min(fit, (size.width / 2 - FRAME_X) / x)
          if (y > 0.01) fit = Math.min(fit, (size.height / 2 - FRAME_TOP) / y)
          else if (y < -0.01) fit = Math.min(fit, (size.height / 2 - FRAME_BOTTOM) / -y)
        }
        desiredZoom = clamp(fit, 16, 150)
      } else {
        controls.target.lerp(HOME, 0.06)
      }
      const idle = now - lastInteract.current > 5
      controls.autoRotate = !reducedMotion && idle
      // Ping-pong between the azimuth limits instead of orbiting all the way.
      const az = controls.getAzimuthalAngle()
      if (az <= AZ_MIN + 0.04) swing.current = -1
      else if (az >= AZ_MAX - 0.04) swing.current = 1
      controls.autoRotateSpeed = 0.45 * swing.current
    }

    // Don't fight a zoom you just made: re-frame only on a fly-to or once
    // you've left the camera alone for a while.
    if (now < flyUntil.current || now - userAt.current > HANDS_OFF) {
      cam.zoom = lerp(cam.zoom, desiredZoom, 0.05)
      cam.updateProjectionMatrix()
    }
    invalidate()
  })

  return null
}
