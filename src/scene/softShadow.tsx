import * as THREE from 'three'

// One shared soft round shadow texture (radial gradient, transparent edges).
// Used instead of drei ContactShadows so shadows never flicker: static under
// furniture, smoothly following each bot — no per-frame shadow re-render.
let tex: THREE.CanvasTexture | null = null
function shadowTexture(): THREE.CanvasTexture {
  if (tex) return tex
  const c = document.createElement('canvas')
  c.width = c.height = 128
  const g = c.getContext('2d')!
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64)
  grad.addColorStop(0, 'rgba(0,0,0,0.5)')
  grad.addColorStop(0.65, 'rgba(0,0,0,0.22)')
  grad.addColorStop(1, 'rgba(0,0,0,0)')
  g.fillStyle = grad
  g.fillRect(0, 0, 128, 128)
  tex = new THREE.CanvasTexture(c)
  return tex
}

export function SoftShadow({
  w = 1,
  d = 1,
  opacity = 0.5,
  position = [0, 0.02, 0],
}: {
  w?: number
  d?: number
  opacity?: number
  position?: [number, number, number]
}) {
  return (
    <mesh rotation-x={-Math.PI / 2} position={position} renderOrder={1}>
      <planeGeometry args={[w, d]} />
      <meshBasicMaterial
        map={shadowTexture()}
        transparent
        opacity={opacity}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}
