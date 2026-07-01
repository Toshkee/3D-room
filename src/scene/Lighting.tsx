import type { RoomPalette } from '../theme'

// Soft, flat lighting for the stylized room — a hemisphere fill for the matte
// look, one gentle key light for shape, plus a front fill so bots and furniture
// facing the camera stay readable (important in the dark theme).
export function Lighting({ p }: { p: RoomPalette }) {
  return (
    <>
      <ambientLight intensity={p.ambient} />
      <hemisphereLight args={[p.hemiSky, p.hemiGround, 0.95]} />
      <directionalLight position={[9, 13, 7]} intensity={p.dirLight} />
      <directionalLight position={[-7, 9, -5]} intensity={p.dirLight * 0.4} />
      {/* front fill toward the camera corner */}
      <directionalLight position={[10, 8, 12]} intensity={p.fill} />
    </>
  )
}
