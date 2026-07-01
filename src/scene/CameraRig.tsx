import { useEffect, useMemo, useRef, useState } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import * as THREE from 'three'
import { clamp } from '../util'

const HOME = new THREE.Vector3(0, 0.9, 0)
const lerp = THREE.MathUtils.lerp

// Minimal shape of the drei/three OrbitControls we drive.
type Ctl = {
  target: THREE.Vector3
  autoRotate: boolean
  autoRotateSpeed: number
  addEventListener(type: string, cb: () => void): void
  removeEventListener(type: string, cb: () => void): void
}

// Cinematic camera: a crane-in intro on load, then OrbitControls with two
// behaviors layered on — "fly to" and track the selected bot as it roams, and a
// gentle idle auto-orbit when you're not touching it. Under reduced motion the
// intro + auto-orbit are skipped (it starts settled).
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
  const [introDone, setIntroDone] = useState(reducedMotion)

  if (!introDone) {
    return <IntroCam homeZoom={homeZoom} onDone={() => setIntroDone(true)} />
  }
  return (
    <>
      <OrbitControls
        makeDefault
        target={[0, 0.9, 0]}
        enablePan={false}
        enableDamping
        dampingFactor={0.09}
        rotateSpeed={0.6}
        zoomSpeed={0.9}
        minZoom={16}
        maxZoom={150}
        minPolarAngle={Math.PI * 0.12}
        maxPolarAngle={Math.PI * 0.47}
      />
      <Director selectedId={selectedId} positions={positions} reducedMotion={reducedMotion} homeZoom={homeZoom} />
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
    cam.lookAt(0, lerp(1.3, 0.9, e), 0)
    cam.updateProjectionMatrix()
    invalidate()
    if (t >= 1) finish()
  })

  return null
}

function Director({
  selectedId,
  positions,
  reducedMotion,
  homeZoom,
}: {
  selectedId: string | null
  positions: { current: Record<string, THREE.Vector3> }
  reducedMotion: boolean
  homeZoom: number
}) {
  const { camera, invalidate } = useThree()
  const controls = useThree((s) => s.controls) as unknown as Ctl | null
  const lastInteract = useRef(0)
  const bump = useRef(false)
  const focus = useMemo(() => new THREE.Vector3(), [])

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
      bump.current = false
    }
    const cam = camera as THREE.OrthographicCamera
    const sel = selectedId ? positions.current[selectedId] : undefined

    let desiredZoom = homeZoom
    if (sel) {
      focus.set(sel.x, 1.0, sel.z)
      controls.target.lerp(focus, 0.09)
      desiredZoom = clamp(homeZoom * 1.7, 16, 150)
      controls.autoRotate = false
      lastInteract.current = now
    } else {
      controls.target.lerp(HOME, 0.06)
      const idle = now - lastInteract.current > 5
      controls.autoRotate = !reducedMotion && idle
      controls.autoRotateSpeed = 0.45
    }

    cam.zoom = lerp(cam.zoom, desiredZoom, 0.05)
    cam.updateProjectionMatrix()
    invalidate()
  })

  return null
}
