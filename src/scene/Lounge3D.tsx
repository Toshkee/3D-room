import { useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import { Grid } from '@react-three/drei'
import * as THREE from 'three'
import { ROOM } from '../theme'
import type { Bot, Theme } from '../types'
import type { Occupancy } from '../data/roam'
import { Room } from './Room'
import { Lighting } from './Lighting'
import { BotAvatar } from './BotAvatar'
import { CameraRig } from './CameraRig'
import { Effects } from './Effects'

export function Lounge3D({
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

  return (
    <Canvas
      orthographic
      camera={{ position: [17, 14, 17], zoom: 40, near: 0.1, far: 400 }}
      dpr={[1, 2]}
      frameloop={reducedMotion ? 'demand' : 'always'}
      gl={{ antialias: true }}
    >
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
      <Effects dark={theme === 'dark'} />
    </Canvas>
  )
}
