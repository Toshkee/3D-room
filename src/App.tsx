import { Suspense, useCallback, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { Scene } from './scene/Scene'
import { Hud } from './components/Hud'
import { ProjectCard } from './components/ProjectCard'
import { PALETTE } from './theme'
import { PROJECTS } from './data/projects'
import { usePrefersReducedMotion } from './usePrefersReducedMotion'

export default function App() {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const reducedMotion = usePrefersReducedMotion()

  const selected = PROJECTS.find((p) => p.id === selectedId) ?? null
  const accent = selected?.css ?? PALETTE.cyan

  const handleSelect = useCallback((id: string) => {
    setSelectedId((cur) => (cur === id ? null : id))
  }, [])
  const handleClose = useCallback(() => setSelectedId(null), [])
  const handleReady = useCallback(() => setReady(true), [])

  return (
    <div className="app" style={{ ['--accent' as string]: accent }}>
      <Canvas
        shadows
        // Under prefers-reduced-motion the scene is static, so render on demand
        // (CameraRig / stations self-invalidate while a glide is animating)
        // instead of running the post pipeline at 60fps forever.
        frameloop={reducedMotion ? 'demand' : 'always'}
        dpr={[1, 2]}
        gl={{
          antialias: false, // AA handled by the EffectComposer
          powerPreference: 'high-performance',
          alpha: false,
        }}
        camera={{ position: [0, 7.4, 16], fov: 34, near: 0.1, far: 100 }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping
          gl.toneMappingExposure = 1.1
        }}
      >
        <color attach="background" args={[PALETTE.base]} />
        <Suspense fallback={null}>
          <Scene selectedId={selectedId} onSelect={handleSelect} onReady={handleReady} />
        </Suspense>
      </Canvas>

      <div className="overlay">
        {/* Keyboard / screen-reader path to every gamer (the 3D meshes aren't
            focusable). Visually hidden until focused. */}
        <nav className="pod-nav" aria-label="Open a project">
          {PROJECTS.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => handleSelect(p.id)}
              aria-pressed={selectedId === p.id}
            >
              {p.add ? `${p.name} (reserved spot)` : `Open ${p.name} — ${p.tag}`}
            </button>
          ))}
        </nav>

        <Hud />
        <ProjectCard project={selected} onClose={handleClose} />
      </div>

      <div className={`loader${ready ? ' hide' : ''}`} aria-hidden={ready}>
        <span className="pulse">Entering the room…</span>
      </div>
    </div>
  )
}
