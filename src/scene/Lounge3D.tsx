import { memo, useLayoutEffect, useRef, useState } from 'react'
import { Canvas, useThree } from '@react-three/fiber'
import { Grid, PerformanceMonitor } from '@react-three/drei'
import * as THREE from 'three'
import { ROOM } from '../theme'
import type { Bot, Theme } from '../types'
import type { Occupancy } from '../data/roam'
import { Room } from './Room'
import { Lighting } from './Lighting'
import { BotAvatar } from './BotAvatar'
import { CameraRig } from './CameraRig'
import { Effects } from './Effects'

// Memoized: chat/activity/artifact updates change the lounge state many times a
// second while a reply streams. Without this the whole 3D tree re-renders on
// every delta, which makes typing feel sticky.
export const Lounge3D = memo(function Lounge3D({
  bots,
  theme,
  selectedId,
  onSelect,
  reducedMotion,
}: {
  bots: Bot[]
  theme: Theme
  selectedId: string | null
  onSelect: (id: string) => void
  reducedMotion: boolean
}) {
  const p = ROOM[theme]
  // Shared, mutated-in-place refs: live bot positions (for overlap + camera
  // follow) and node claims (so two bots never target the same spot).
  const positions = useRef<Record<string, THREE.Vector3>>({})
  const occupancy = useRef<Occupancy>({ claim: {} })
  // Render-resolution governor: start at 1.5 (retina costs ~4x the fragments of
  // 1x — full 2x is not worth it under the post pipeline) and step down to 1
  // if the frame rate sags on weaker GPUs.
  const [dpr, setDpr] = useState(1.5)

  return (
    <Canvas
      shadows="soft"
      orthographic
      camera={{ position: [17, 14, 17], zoom: 40, near: 0.1, far: 400 }}
      dpr={dpr}
      frameloop={reducedMotion ? 'demand' : 'always'}
      gl={{ antialias: false, powerPreference: 'high-performance' }}
    >
      <PerformanceMonitor
        onDecline={() => setDpr(1)}
        onIncline={() => setDpr(1.5)}
      />
      <color attach="background" args={[p.fog]} />
      <CameraRig selectedId={selectedId} positions={positions} reducedMotion={reducedMotion} />
      <Lighting p={p} />
      <Room p={p} />
      <Grid
        position={[0, 0.006, 0]}
        args={[22, 18]}
        cellSize={1}
        cellThickness={0.6}
        cellColor={p.gridCell}
        sectionSize={4}
        sectionThickness={1.1}
        sectionColor={p.gridSection}
        fadeDistance={42}
        fadeStrength={1.2}
        followCamera={false}
      />
      {bots.map((bot) => (
        <BotAvatar
          key={bot.id}
          bot={bot}
          selected={bot.id === selectedId}
          onSelect={onSelect}
          reducedMotion={reducedMotion}
          positions={positions}
          occupancy={occupancy}
        />
      ))}
      <SceneShadows dep={bots.length} />
      <Effects dark={theme === 'dark'} />
    </Canvas>
  )
})

// Flip on cast+receive shadows for every solid mesh in the scene (furniture,
// bots, floor, rugs). Skips transparent meshes — the grid, neon glow decals and
// bot rings — so they don't stamp hard rectangular shadows. Re-runs when the
// roster changes so imported bots get grounded too.
function SceneShadows({ dep }: { dep: number }) {
  const scene = useThree((s) => s.scene)
  useLayoutEffect(() => {
    scene.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const mat = m.material as THREE.Material | undefined
      if (!mat || mat.transparent) return
      m.castShadow = true
      m.receiveShadow = true
    })
  }, [scene, dep])
  return null
}
