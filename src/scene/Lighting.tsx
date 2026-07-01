import { Environment } from '@react-three/drei'
import { ROOM, HDRI_URL } from '../theme'
import { LOW_POWER } from '../lowPower'

/**
 * Photoreal lighting: an interior HDRI drives image-based fill + reflections,
 * one shadow-casting key light gives grounded directional shadows, and a few
 * warm ceiling fills sell the "lights are on" feel. The colored mood comes from
 * the emissive monitors / RGB strips + the bloom pass, not from tinted lights.
 */
export function Lighting() {
  const shadowSize = LOW_POWER ? 1024 : 2048

  return (
    <>
      <Environment files={HDRI_URL} environmentIntensity={0.45} />

      {/* tiny ambient floor so nothing is pure black */}
      <ambientLight intensity={0.16} />
      <hemisphereLight intensity={0.22} color="#cfe0ff" groundColor="#1a141f" />

      {/* key light — soft directional from the open front, casts the shadows */}
      <directionalLight
        position={[5.5, 11, 9]}
        intensity={1.9}
        color="#fff2df"
        castShadow
        shadow-mapSize-width={shadowSize}
        shadow-mapSize-height={shadowSize}
        shadow-bias={-0.0004}
        shadow-normalBias={0.02}
        shadow-camera-near={1}
        shadow-camera-far={40}
        shadow-camera-left={-ROOM.W / 2 - 1}
        shadow-camera-right={ROOM.W / 2 + 1}
        shadow-camera-top={ROOM.D / 2 + 2}
        shadow-camera-bottom={-ROOM.D / 2 - 2}
      />

      {/* warm ceiling fills (no shadows, cheap) under the panels */}
      {[-4, 0, 4].map((px) => (
        <pointLight
          key={px}
          position={[px, ROOM.H - 0.4, -0.5]}
          intensity={6}
          distance={9}
          decay={2}
          color="#ffe9c9"
        />
      ))}

      {/* cool fill from the camera side so faces aren't lost in shadow */}
      <pointLight position={[0, 3.4, 8.6]} intensity={5} distance={18} decay={2} color="#9fb8ff" />

      {/* a warm fill over the lounge nook so the loungers + sofa read */}
      <pointLight position={[0, 3.3, 4.6]} intensity={5.5} distance={12} decay={2} color="#ffe2c2" />
      {/* a soft front fill aimed at the sofa so the loungers' faces aren't black */}
      <pointLight position={[0, 2.2, 7.2]} intensity={3} distance={9} decay={2} color="#ffeede" />
    </>
  )
}
