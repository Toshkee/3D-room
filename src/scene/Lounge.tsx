import { HEX } from '../theme'

const FABRIC = '#2c2733'
const FABRIC2 = '#332d3c'

/**
 * The social middle of the room: a rug, a sofa facing into the lounge, and a
 * coffee table. Food + drinks (FoodDrinks) and decor (Decor) dress it further.
 */
export function Lounge() {
  return (
    <group>
      {/* rug */}
      <mesh position={[0, 0.012, 2.0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[5.6, 4.6]} />
        <meshStandardMaterial color={HEX.carpet} roughness={0.95} />
      </mesh>

      {/* sofa at the front, facing into the room (-Z) */}
      <group position={[0, 0, 3.7]}>
        <mesh castShadow receiveShadow position={[0, 0.26, 0]}>
          <boxGeometry args={[3.0, 0.4, 1.0]} />
          <meshStandardMaterial color={FABRIC} roughness={0.85} />
        </mesh>
        {/* seat cushions */}
        {[-0.95, 0, 0.95].map((cx) => (
          <mesh key={cx} castShadow position={[cx, 0.5, 0.04]}>
            <boxGeometry args={[0.92, 0.18, 0.86]} />
            <meshStandardMaterial color={FABRIC2} roughness={0.8} />
          </mesh>
        ))}
        {/* backrest */}
        <mesh castShadow position={[0, 0.7, 0.46]}>
          <boxGeometry args={[3.0, 0.7, 0.22]} />
          <meshStandardMaterial color={FABRIC} roughness={0.85} />
        </mesh>
        {/* arms */}
        {[-1.48, 1.48].map((ax) => (
          <mesh key={ax} castShadow position={[ax, 0.46, 0]}>
            <boxGeometry args={[0.22, 0.5, 1.0]} />
            <meshStandardMaterial color={FABRIC} roughness={0.85} />
          </mesh>
        ))}
      </group>

      {/* coffee table */}
      <group position={[0, 0, 2.0]}>
        <mesh castShadow receiveShadow position={[0, 0.42, 0]}>
          <boxGeometry args={[1.5, 0.06, 0.8]} />
          <meshStandardMaterial color={HEX.deskTop} metalness={0.2} roughness={0.4} />
        </mesh>
        {[
          [-0.68, 0.34],
          [0.68, 0.34],
          [-0.68, -0.34],
          [0.68, -0.34],
        ].map(([lx, lz], i) => (
          <mesh key={i} castShadow position={[lx, 0.2, lz]}>
            <boxGeometry args={[0.05, 0.4, 0.05]} />
            <meshStandardMaterial color={HEX.metal} metalness={0.7} roughness={0.4} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
