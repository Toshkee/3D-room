import type { RoomPalette } from '../theme'

// Soft, flat lighting for the stylized room — a hemisphere fill for the matte
// look, one gentle key light for shape, plus a front fill so bots and furniture
// facing the camera stay readable (important in the dark theme).
export function Lighting({ p }: { p: RoomPalette }) {
  return (
    <>
      <ambientLight intensity={p.ambient} />
      <hemisphereLight args={[p.hemiSky, p.hemiGround, 0.85]} />
      {/* warm key light from the upper-right for shape */}
      <directionalLight position={[9, 13, 7]} intensity={p.dirLight} color={p.keyColor} />
      {/* cool back/rim light from behind for separation */}
      <directionalLight position={[-7, 9, -5]} intensity={p.dirLight * 0.45} color={p.fillColor} />
      {/* cool front fill toward the camera corner keeps faces readable */}
      <directionalLight position={[10, 8, 12]} intensity={p.fill} color={p.fillColor} />
    </>
  )
}
