import { HEX } from '../theme'
import { LOUNGE } from '../data/lounge'

// Believable, desaturated set-dressing colors (literals are fine for the soft
// furnishings + foliage, the way Lounge.tsx names its fabrics).
const POT = '#43352b' // dark terracotta planters
const FOLIAGE = '#2f4a32' // matte leaves, lit by the room not glowing
const FOLIAGE2 = '#3a5a3d'
const GOLD = '#caa14a' // trophy cup — the one faint emissive accent on the shelf
const BULB = '#ffcf9a' // warm pendant bulb

// Potted plants tucked into the open corners + along a side wall, well clear of
// the desks and the lounge nook.
const PLANTS: [number, number, number][] = [
  [-8.6, 0, 6.8],
  [8.6, 0, 6.8],
  [-8.9, 0, 1.8],
]

// A row of paperbacks leaning on the shelf's middle plank (x offset, height, spine).
const BOOKS: { x: number; h: number; color: string }[] = [
  { x: -0.3, h: 0.5, color: '#3b4a6b' },
  { x: -0.18, h: 0.44, color: '#6b3a48' },
  { x: -0.06, h: 0.48, color: '#3f5a3c' },
]

// The tower's RGB dots, glimpsed through its glass panel (magenta / cyan / green).
const RGB = [HEX.magenta, HEX.cyan, 0x6fe27a]

/**
 * Lived-in lounge decor that fills the open floor + ceiling around the central
 * sofa without crowding the gamers: corner plants, a small trophy shelf in the
 * back corner, a glass-panel PC tower, and two warm pendant lamps over the
 * coffee table. All static primitives — the glow is just emissive material, the
 * bloom pass does the rest.
 */
export function Decor() {
  return (
    <group>
      {/* ---- potted plants in the open corners ---- */}
      {PLANTS.map(([px, , pz], i) => (
        <group key={i} position={[px, 0, pz]}>
          {/* tapered terracotta pot */}
          <mesh castShadow receiveShadow position={[0, 0.25, 0]}>
            <cylinderGeometry args={[0.26, 0.2, 0.5, 14]} />
            <meshStandardMaterial color={POT} roughness={0.85} />
          </mesh>
          {/* a loose cluster of leafy spheres sitting in the pot */}
          <mesh castShadow position={[0, 0.95, 0]}>
            <sphereGeometry args={[0.34, 10, 8]} />
            <meshStandardMaterial color={FOLIAGE} roughness={0.9} />
          </mesh>
          <mesh castShadow position={[0.2, 0.8, 0.06]}>
            <sphereGeometry args={[0.24, 10, 8]} />
            <meshStandardMaterial color={FOLIAGE2} roughness={0.9} />
          </mesh>
          <mesh castShadow position={[-0.18, 0.84, -0.05]}>
            <sphereGeometry args={[0.22, 10, 8]} />
            <meshStandardMaterial color={FOLIAGE} roughness={0.9} />
          </mesh>
        </group>
      ))}

      {/* ---- trophy / book shelf in the back-left corner ---- */}
      <group position={[-8.8, 0, -7.2]}>
        {/* open frame: two side panels + bottom, middle and top planks */}
        {[-0.53, 0.53].map((sx) => (
          <mesh key={sx} castShadow receiveShadow position={[sx, 1.0, 0]}>
            <boxGeometry args={[0.05, 2.0, 0.34]} />
            <meshStandardMaterial color={HEX.plasticDark} roughness={0.7} />
          </mesh>
        ))}
        {[0.05, 1.0, 1.98].map((sy) => (
          <mesh key={sy} castShadow receiveShadow position={[0, sy, 0]}>
            <boxGeometry args={[1.1, 0.05, 0.34]} />
            <meshStandardMaterial color={HEX.plasticDark} roughness={0.7} />
          </mesh>
        ))}
        {/* paperbacks on the middle plank */}
        {BOOKS.map((b) => (
          <mesh key={b.x} position={[b.x, 1.025 + b.h / 2, 0]}>
            <boxGeometry args={[0.09, b.h, 0.26]} />
            <meshStandardMaterial color={b.color} roughness={0.85} />
          </mesh>
        ))}
        {/* a little trophy on the top plank — base + faintly glowing cup */}
        <mesh position={[0.28, 2.03, 0]}>
          <boxGeometry args={[0.12, 0.04, 0.12]} />
          <meshStandardMaterial color={HEX.metal} metalness={0.6} roughness={0.4} />
        </mesh>
        <mesh position={[0.28, 2.13, 0]}>
          <cylinderGeometry args={[0.06, 0.035, 0.13, 12]} />
          <meshStandardMaterial
            color={GOLD}
            emissive={GOLD}
            emissiveIntensity={1.8}
            metalness={0.3}
            roughness={0.3}
            toneMapped={false}
          />
        </mesh>
      </group>

      {/* ---- gaming PC tower on the floor in the back-right corner ---- */}
      <group position={[8.8, 0, -7.2]}>
        <mesh castShadow receiveShadow position={[0, 0.5, 0]}>
          <boxGeometry args={[0.46, 1.0, 0.5]} />
          <meshStandardMaterial color={HEX.plasticDark} metalness={0.4} roughness={0.45} />
        </mesh>
        {/* tinted glass side panel — a soft interior glow, not a neon slab */}
        <mesh position={[0, 0.52, 0.255]}>
          <boxGeometry args={[0.32, 0.78, 0.015]} />
          <meshStandardMaterial
            color="#16263f"
            emissive="#1f4f8a"
            emissiveIntensity={0.9}
            metalness={0.1}
            roughness={0.25}
            toneMapped={false}
          />
        </mesh>
        {/* RGB fan dots glimpsed through the glass */}
        {RGB.map((c, i) => (
          <mesh key={i} position={[-0.17, 0.3 + i * 0.22, 0.255]}>
            <sphereGeometry args={[0.025, 8, 8]} />
            <meshStandardMaterial color={c} emissive={c} emissiveIntensity={2.2} toneMapped={false} />
          </mesh>
        ))}
      </group>

      {/* ---- two pendant lamps hanging over the coffee table ---- */}
      <group position={[LOUNGE.table.pos[0], 0, LOUNGE.table.pos[1]]}>
        {[-0.85, 0.85].map((lx) => (
          <group key={lx}>
            {/* thin drop rod from the ceiling */}
            <mesh position={[lx, 3.6, 0]}>
              <cylinderGeometry args={[0.012, 0.012, 1.2, 6]} />
              <meshStandardMaterial color={HEX.metal} metalness={0.7} roughness={0.4} />
            </mesh>
            {/* conical shade */}
            <mesh position={[lx, 2.98, 0]}>
              <coneGeometry args={[0.17, 0.2, 16]} />
              <meshStandardMaterial color={HEX.plasticDark} metalness={0.3} roughness={0.5} />
            </mesh>
            {/* warm bulb peeking out below (blooms) */}
            <mesh position={[lx, 2.9, 0]}>
              <sphereGeometry args={[0.07, 12, 10]} />
              <meshStandardMaterial color={BULB} emissive={BULB} emissiveIntensity={2.0} toneMapped={false} />
            </mesh>
          </group>
        ))}
      </group>
    </group>
  )
}
