import * as THREE from 'three'
import { HEX, ROOM, HALF_W, HALF_D } from '../theme'

const PI = Math.PI

/**
 * The room shell: floor, the three enclosing walls (the +z side is left open for
 * the camera), ceiling with recessed light panels, baseboards, a faint LED cove,
 * and a big wall screen. Furniture / decor / food live in their own components.
 */
export function Room() {
  return (
    <group>
      {/* floor — low-roughness so monitor glow + the HDRI sheen reflect a touch */}
      <mesh rotation={[-PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[ROOM.W, ROOM.D]} />
        <meshStandardMaterial color={HEX.floor} roughness={0.3} metalness={0.1} envMapIntensity={0.9} />
      </mesh>

      {/* ceiling */}
      <mesh position={[0, ROOM.H, 0]} rotation={[PI / 2, 0, 0]}>
        <planeGeometry args={[ROOM.W, ROOM.D]} />
        <meshStandardMaterial color={HEX.ceiling} roughness={0.95} />
      </mesh>

      {/* recessed ceiling light panels (also real lights in Lighting.tsx) */}
      {[-4, 0, 4].map((px) => (
        <mesh key={px} position={[px, ROOM.H - 0.02, -0.5]} rotation={[PI / 2, 0, 0]}>
          <planeGeometry args={[1.6, 5.2]} />
          <meshStandardMaterial color="#fff4e2" emissive="#fff1da" emissiveIntensity={1.1} toneMapped={false} />
        </mesh>
      ))}

      {/* back + side walls */}
      <Wall position={[0, ROOM.H / 2, -HALF_D]} rotation={[0, 0, 0]} width={ROOM.W} />
      <Wall position={[-HALF_W, ROOM.H / 2, 0]} rotation={[0, PI / 2, 0]} width={ROOM.D} />
      <Wall position={[HALF_W, ROOM.H / 2, 0]} rotation={[0, -PI / 2, 0]} width={ROOM.D} />

      {/* the big wall screen — the lounge's focal point — centered up high */}
      <group position={[0, 2.85, -HALF_D + 0.06]}>
        <mesh>
          <boxGeometry args={[4.8, 2.4, 0.09]} />
          <meshStandardMaterial color={HEX.plasticDark} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0, 0.06]}>
          <planeGeometry args={[4.6, 2.2]} />
          <meshStandardMaterial color="#1a2b4d" emissive="#2a4f96" emissiveIntensity={1.15} toneMapped={false} roughness={0.3} />
        </mesh>
      </group>
    </group>
  )
}

function Wall({
  position,
  rotation,
  width,
}: {
  position: [number, number, number]
  rotation: [number, number, number]
  width: number
}) {
  return (
    <group position={position} rotation={rotation}>
      {/* main wall */}
      <mesh receiveShadow>
        <planeGeometry args={[width, ROOM.H]} />
        <meshStandardMaterial color={HEX.wall} roughness={0.92} side={THREE.FrontSide} />
      </mesh>
      {/* darker wainscot along the bottom */}
      <mesh position={[0, -ROOM.H / 2 + 0.6, 0.01]} receiveShadow>
        <planeGeometry args={[width, 1.2]} />
        <meshStandardMaterial color={HEX.wallLow} roughness={0.9} />
      </mesh>
      {/* baseboard */}
      <mesh position={[0, -ROOM.H / 2 + 0.06, 0.02]}>
        <boxGeometry args={[width, 0.12, 0.04]} />
        <meshStandardMaterial color={HEX.trim} roughness={0.8} />
      </mesh>
      {/* faint LED cove near the ceiling */}
      <mesh position={[0, ROOM.H / 2 - 0.14, 0.03]}>
        <boxGeometry args={[width - 0.4, 0.025, 0.02]} />
        <meshStandardMaterial color="#5fb8ff" emissive="#5fb8ff" emissiveIntensity={1.4} toneMapped={false} />
      </mesh>
    </group>
  )
}
