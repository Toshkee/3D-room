import { Text } from '@react-three/drei'
import { HEX } from '../theme'

// Muted poster fills — these get a *faint* self-glow so they read in the dim
// room without crossing the bloom threshold.
const POSTER_BACK_A = '#2e2a44' // muted indigo
const POSTER_BACK_B = '#37283c' // muted plum
const POSTER_SIDE = '#22323e' // muted teal
// The one little neon flourish: a low-saturation cyan, kept bright so the small
// underline bar (and the word) just barely bloom.
const SIGN = '#7fd8ff'

/**
 * Wall treatment up above the desks (everything sits at y > 2.2 so nothing
 * collides with a seated gamer or their monitor). The back wall gets framed art
 * flanking the existing TV, a small neon "GAME ON" sign and a clock; each side
 * wall gets a grid of dark acoustic-foam wedges and a single framed poster.
 *
 * Static decor only — no hooks, no animation. Walls are entered as groups whose
 * local +Z faces into the room, matching Room.tsx's wall convention.
 */
export function WallDressing() {
  return (
    <group>
      {/* ---- back wall (just in front of the wall plane, looking +Z) ---- */}
      <group position={[0, 0, -7.95]}>
        {/* framed art flanking the big TV */}
        <FramedArt position={[-6.4, 2.8, 0.03]} width={1.0} height={1.2} art={POSTER_BACK_A} />
        <FramedArt position={[6.4, 2.8, 0.03]} width={1.0} height={1.2} art={POSTER_BACK_B} />

        {/* tiny neon sign tucked in the gap right of the TV */}
        <Text position={[3.4, 3.2, 0.05]} fontSize={0.3} anchorX="center" anchorY="middle" letterSpacing={0.05}>
          GAME ON
          <meshBasicMaterial color={SIGN} toneMapped={false} />
        </Text>
        <mesh position={[3.4, 3.0, 0.05]}>
          <boxGeometry args={[1.2, 0.03, 0.02]} />
          <meshStandardMaterial color={SIGN} emissive={SIGN} emissiveIntensity={1.8} toneMapped={false} />
        </mesh>

        {/* a plain wall clock in the gap left of the TV */}
        <group position={[-3.4, 3.2, 0.04]}>
          <mesh>
            <torusGeometry args={[0.24, 0.02, 10, 32]} />
            <meshStandardMaterial color={HEX.metal} metalness={0.7} roughness={0.4} />
          </mesh>
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <cylinderGeometry args={[0.23, 0.23, 0.02, 32]} />
            <meshStandardMaterial color={HEX.plasticDark} roughness={0.6} />
          </mesh>
          {/* hour + minute hands, frozen at a tidy time */}
          <group position={[0, 0, 0.02]} rotation={[0, 0, -0.6]}>
            <mesh position={[0, 0.05, 0]}>
              <boxGeometry args={[0.018, 0.12, 0.008]} />
              <meshStandardMaterial color="#cfc6e0" roughness={0.5} />
            </mesh>
          </group>
          <group position={[0, 0, 0.02]} rotation={[0, 0, 1.4]}>
            <mesh position={[0, 0.085, 0]}>
              <boxGeometry args={[0.014, 0.18, 0.008]} />
              <meshStandardMaterial color="#cfc6e0" roughness={0.5} />
            </mesh>
          </group>
        </group>
      </group>

      {/* ---- side walls (foam + one poster each), flush + facing inward ---- */}
      <SideWall position={[-9.45, 0, 0]} rotation={[0, Math.PI / 2, 0]} />
      <SideWall position={[9.45, 0, 0]} rotation={[0, -Math.PI / 2, 0]} />
    </group>
  )
}

/** A boxed frame with a slightly-proud, faintly-glowing art panel facing +Z. */
function FramedArt({
  position,
  width,
  height,
  art,
}: {
  position: [number, number, number]
  width: number
  height: number
  art: string
}) {
  return (
    <group position={position}>
      <mesh castShadow>
        <boxGeometry args={[width, height, 0.05]} />
        <meshStandardMaterial color={HEX.trim} metalness={0.3} roughness={0.6} />
      </mesh>
      <mesh position={[0, 0, 0.03]}>
        <planeGeometry args={[width - 0.12, height - 0.12]} />
        <meshStandardMaterial color={art} emissive={art} emissiveIntensity={0.35} roughness={0.5} toneMapped={false} />
      </mesh>
    </group>
  )
}

// Acoustic-foam tiles: dark squares rotated 45° into a diamond grid. Local +Z
// (offset 0.03) faces into the room within each side-wall group.
const FOAM_COLS = [0.6, 1.6, 2.6]
const FOAM_ROWS = [3.0, 3.5]

/** One side wall: a tessellated foam patch toward the back, one framed poster. */
function SideWall({
  position,
  rotation,
}: {
  position: [number, number, number]
  rotation: [number, number, number]
}) {
  return (
    <group position={position} rotation={rotation}>
      {FOAM_ROWS.map((ly) =>
        FOAM_COLS.map((lx) => (
          <mesh key={`${lx}:${ly}`} position={[lx, ly, 0.03]} rotation={[0, 0, Math.PI / 4]}>
            <boxGeometry args={[0.32, 0.32, 0.05]} />
            <meshStandardMaterial color={HEX.plasticDark} roughness={0.95} />
          </mesh>
        )),
      )}
      <FramedArt position={[-1.6, 2.85, 0.03]} width={1.0} height={1.1} art={POSTER_SIDE} />
    </group>
  )
}
