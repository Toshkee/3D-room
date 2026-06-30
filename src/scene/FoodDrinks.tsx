import * as THREE from 'three'
import { HEX } from '../theme'

// Coffee-table top surface (Lounge table: y=0.42 box, 0.06 tall → top at 0.45).
const TABLE = 0.45

// Matte packaging + food colors (literals read better here than the room palette).
const CARD = '#b5824c' // pizza-box cardboard
const CRUST = '#cf9a4e' // slice crust
const CHEESE = '#d8a441' // baked cheese
const CUP = '#e7e2d8' // paper cup
const LID = '#cdc8d0' // cup lid
const CHIP = '#e7c25a' // bowl chips
const BAG = '#7a3a2c' // crumpled snack bag

// Energy-drink / soda cans: [x, baseY, z, label]. Three crowd the table; one's
// been left down on the rug by the sofa. The label band is the only part that glows.
const CANS: [number, number, number, THREE.ColorRepresentation][] = [
  [0.6, TABLE, 2.28, HEX.cyan],
  [-0.62, TABLE, 2.18, HEX.magenta],
  [0.22, TABLE, 1.7, '#9be83a'],
  [2.3, 0, 3.55, '#ff8a3d'],
]

// Paper cups (body + lid + straw): [x, z, straw accent].
const CUPS: [number, number, THREE.ColorRepresentation][] = [
  [-0.08, 2.3, HEX.magenta],
  [0.42, 1.72, HEX.cyan],
]

// Slices: [x, localY, z, yaw]. The first still sits in the open box.
const SLICES: [number, number, number, number][] = [
  [-0.3, 0.035, 2.0, 0.6],
  [0.16, 0.01, 2.2, 2.1],
  [0.02, 0.01, 1.75, -1.1],
]

// Thin-walled bowl profile [radius, height] revolved into a shallow open dish.
const BOWL = [
  new THREE.Vector2(0.0, 0.035),
  new THREE.Vector2(0.09, 0.02),
  new THREE.Vector2(0.16, 0.0),
  new THREE.Vector2(0.18, 0.1),
  new THREE.Vector2(0.165, 0.1),
  new THREE.Vector2(0.13, 0.025),
  new THREE.Vector2(0.0, 0.05),
]

/**
 * Snacks + drinks for a gaming session: an open pizza box with slices, a clutter
 * of energy-drink cans, capped cups, a chip bowl and a tossed bag — most of it on
 * the coffee table, a couple of pieces left on the rug. Static set dressing only.
 */
export function FoodDrinks() {
  return (
    <group>
      {/* ---- open pizza box (left of the table) ---- */}
      <group position={[-0.3, TABLE, 1.98]}>
        {/* base */}
        <mesh receiveShadow position={[0, 0.015, 0]}>
          <boxGeometry args={[0.42, 0.03, 0.42]} />
          <meshStandardMaterial color={CARD} roughness={0.95} />
        </mesh>
        {/* lid, hinged at the back edge and flipped open */}
        <group position={[0, 0.03, -0.21]} rotation={[1.1, 0, 0]}>
          <mesh position={[0, 0, -0.21]}>
            <boxGeometry args={[0.42, 0.02, 0.42]} />
            <meshStandardMaterial color={CARD} roughness={0.95} />
          </mesh>
        </group>
      </group>

      {/* ---- pizza slices (one in the box, two pulled out) ---- */}
      {SLICES.map(([x, y, z, yaw], i) => (
        <group key={i} position={[x, TABLE + y, z]} rotation={[0, yaw, 0]}>
          <mesh>
            <cylinderGeometry args={[0.17, 0.17, 0.02, 3, 1, false, 0, 0.95]} />
            <meshStandardMaterial color={CHEESE} roughness={0.7} />
          </mesh>
          {/* a touch of crust along the outer arc */}
          <mesh position={[0.14, 0, 0.05]}>
            <cylinderGeometry args={[0.024, 0.024, 0.024, 8]} />
            <meshStandardMaterial color={CRUST} roughness={0.85} />
          </mesh>
        </group>
      ))}

      {/* ---- cans (table clutter + one on the rug) ---- */}
      {CANS.map(([x, by, z, label], i) => (
        <group key={i} position={[x, by, z]}>
          <mesh position={[0, 0.065, 0]}>
            <cylinderGeometry args={[0.037, 0.04, 0.13, 18]} />
            <meshStandardMaterial color={HEX.metal} metalness={0.85} roughness={0.3} />
          </mesh>
          {/* glowing label band */}
          <mesh position={[0, 0.06, 0]}>
            <cylinderGeometry args={[0.041, 0.041, 0.07, 18, 1, true]} />
            <meshStandardMaterial
              color={label}
              emissive={label}
              emissiveIntensity={1.7}
              roughness={0.4}
              toneMapped={false}
            />
          </mesh>
        </group>
      ))}

      {/* ---- capped cups with straws ---- */}
      {CUPS.map(([x, z, straw], i) => (
        <group key={i} position={[x, TABLE, z]}>
          <mesh position={[0, 0.065, 0]}>
            <cylinderGeometry args={[0.046, 0.034, 0.13, 18]} />
            <meshStandardMaterial color={CUP} roughness={0.85} />
          </mesh>
          <mesh position={[0, 0.141, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 0.022, 18]} />
            <meshStandardMaterial color={LID} roughness={0.6} />
          </mesh>
          <mesh position={[0.015, 0.2, 0]} rotation={[0, 0, 0.3]}>
            <cylinderGeometry args={[0.006, 0.006, 0.14, 8]} />
            <meshStandardMaterial color={straw} roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* ---- snack bowl with a mound of chips (right of the table) ---- */}
      <group position={[0.52, TABLE, 1.95]}>
        <mesh receiveShadow>
          <latheGeometry args={[BOWL, 24]} />
          <meshStandardMaterial
            color={HEX.plasticDark}
            metalness={0.2}
            roughness={0.5}
            side={THREE.DoubleSide}
          />
        </mesh>
        {/* heaped chips */}
        <mesh position={[0, 0.07, 0]} scale={[0.14, 0.055, 0.14]}>
          <sphereGeometry args={[1, 12, 8]} />
          <meshStandardMaterial color={CHIP} roughness={0.8} />
        </mesh>
        {/* a couple sticking up out of the pile */}
        {[
          [0.05, 0.11, 0.02, 0.5],
          [-0.04, 0.1, -0.03, -0.7],
        ].map(([cx, cy, cz, tilt], i) => (
          <mesh key={i} position={[cx, cy, cz]} rotation={[tilt, 0.4, tilt]}>
            <boxGeometry args={[0.07, 0.006, 0.06]} />
            <meshStandardMaterial color={CHIP} roughness={0.8} />
          </mesh>
        ))}
      </group>

      {/* ---- crumpled chips bag tossed on the rug by the sofa ---- */}
      <mesh position={[-2.3, 0.045, 3.7]} rotation={[0.12, 0.6, 0.18]}>
        <boxGeometry args={[0.16, 0.07, 0.2]} />
        <meshStandardMaterial color={BAG} roughness={0.9} />
      </mesh>
    </group>
  )
}
