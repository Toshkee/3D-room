import type { RoomPalette } from '../theme'

// Soft, flat lighting for the stylized room — a hemisphere fill for the matte
// look, one gentle key light for shape, plus a front fill so bots and furniture
// facing the camera stay readable (important in the dark theme).
export function Lighting({ p }: { p: RoomPalette }) {
  return (
    <>
      <ambientLight intensity={p.ambient} />
      <hemisphereLight args={[p.hemiSky, p.hemiGround, 0.85]} />
      {/* warm key light from the upper-right — the one shadow caster, so
          furniture + bots throw soft shadows across the floor (real grounding) */}
      <directionalLight
        position={[9, 13, 7]}
        intensity={p.dirLight}
        color={p.keyColor}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-near={1}
        shadow-camera-far={64}
        shadow-camera-left={-16}
        shadow-camera-right={16}
        shadow-camera-top={16}
        shadow-camera-bottom={-16}
        shadow-bias={-0.0004}
        shadow-normalBias={0.045}
      />
      {/* cool back/rim light from behind for separation */}
      <directionalLight position={[-7, 9, -5]} intensity={p.dirLight * 0.45} color={p.fillColor} />
      {/* cool front fill toward the camera corner keeps faces readable */}
      <directionalLight position={[10, 8, 12]} intensity={p.fill} color={p.fillColor} />
    </>
  )
}
