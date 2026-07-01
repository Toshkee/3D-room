import * as THREE from 'three'
import { HEX } from '../theme'
import { LOUNGE } from '../data/lounge'

const T = LOUNGE.table
const TOP = T.topY // coffee-table top surface

// Matte packaging + food colors (literals read better here than the room palette).
const CARD = '#b5824c' // pizza-box cardboard
const CRUST = '#cf9a4e' // slice crust
const CHEESE = '#d8a441' // baked cheese
const CUP = '#e7e2d8' // paper cup
const LID = '#cdc8d0' // cup lid
const CHIP = '#e7c25a' // bowl chips
const BAG = '#7a3a2c' // crumpled snack bag

// Energy-drink / soda cans clustered on the table: [localX, localZ, label].
const TABLE_CANS: [number, number, THREE.ColorRepresentation][] = [
  [0.58, 0.26, HEX.cyan],
  [-0.6, 0.18, HEX.magenta],
  [0.22, -0.28, '#9be83a'],
]

// Paper cups (body + lid + straw): [localX, localZ, straw accent].
const CUPS: [number, number, THREE.ColorRepresentation][] = [
  [-0.08, 0.3, HEX.magenta],
  [0.42, -0.26, HEX.cyan],
]

// Slices: [localX, localY, localZ, yaw]. The first still sits in the open box.
const SLICES: [number, number, number, number][] = [
  [-0.32, 0.035, -0.02, 0.6],
  [0.14, 0.01, 0.2, 2.1],
  [0.0, 0.01, -0.24, -1.1],
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

/** A capped paper cup with a straw, sitting on the table. */
function Cup({ straw }: { straw: THREE.ColorRepresentation }) {
  return (
    <>
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
    </>
  )
}

/** A drink can — only the label band glows. */
function Can({ label }: { label: THREE.ColorRepresentation }) {
  return (
    <>
      <mesh position={[0, 0.065, 0]}>
        <cylinderGeometry args={[0.037, 0.04, 0.13, 18]} />
        <meshStandardMaterial color={HEX.metal} metalness={0.85} roughness={0.3} />
      </mesh>
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[0.041, 0.041, 0.07, 18, 1, true]} />
        <meshStandardMaterial color={label} emissive={label} emissiveIntensity={1.7} roughness={0.4} toneMapped={false} />
      </mesh>
    </>
  )
}

/**
 * Snacks + drinks for the lounge: an open pizza box with slices, a clutter of
 * energy-drink cans, capped cups, a chip bowl on the coffee table, plus a can
 * and a tossed bag left on the rug. Static set dressing only.
 */
export function FoodDrinks() {
  return (
    <group>
      {/* ---- everything clustered on the coffee table ---- */}
      <group position={[T.pos[0], 0, T.pos[1]]}>
        {/* open pizza box */}
        <group position={[-0.32, TOP, -0.04]}>
          <mesh receiveShadow position={[0, 0.015, 0]}>
            <boxGeometry args={[0.42, 0.03, 0.42]} />
            <meshStandardMaterial color={CARD} roughness={0.95} />
          </mesh>
          <group position={[0, 0.03, -0.21]} rotation={[1.1, 0, 0]}>
            <mesh position={[0, 0, -0.21]}>
              <boxGeometry args={[0.42, 0.02, 0.42]} />
              <meshStandardMaterial color={CARD} roughness={0.95} />
            </mesh>
          </group>
        </group>

        {/* pizza slices */}
        {SLICES.map(([x, y, z, yaw], i) => (
          <group key={i} position={[x, TOP + y, z]} rotation={[0, yaw, 0]}>
            <mesh>
              <cylinderGeometry args={[0.17, 0.17, 0.02, 3, 1, false, 0, 0.95]} />
              <meshStandardMaterial color={CHEESE} roughness={0.7} />
            </mesh>
            <mesh position={[0.14, 0, 0.05]}>
              <cylinderGeometry args={[0.024, 0.024, 0.024, 8]} />
              <meshStandardMaterial color={CRUST} roughness={0.85} />
            </mesh>
          </group>
        ))}

        {/* cans + cups */}
        {TABLE_CANS.map(([x, z, label], i) => (
          <group key={i} position={[x, TOP, z]}>
            <Can label={label} />
          </group>
        ))}
        {CUPS.map(([x, z, straw], i) => (
          <group key={i} position={[x, TOP, z]}>
            <Cup straw={straw} />
          </group>
        ))}

        {/* snack bowl with a mound of chips */}
        <group position={[0.5, TOP, -0.06]}>
          <mesh receiveShadow>
            <latheGeometry args={[BOWL, 24]} />
            <meshStandardMaterial color={HEX.plasticDark} metalness={0.2} roughness={0.5} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[0, 0.07, 0]} scale={[0.14, 0.055, 0.14]}>
            <sphereGeometry args={[1, 12, 8]} />
            <meshStandardMaterial color={CHIP} roughness={0.8} />
          </mesh>
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
      </group>

      {/* ---- a stray can + crumpled bag left on the rug ---- */}
      <group position={[2.1, 0, 5.6]}>
        <Can label="#ff8a3d" />
      </group>
      <mesh position={[-1.7, 0.045, 5.7]} rotation={[0.12, 0.6, 0.18]}>
        <boxGeometry args={[0.16, 0.07, 0.2]} />
        <meshStandardMaterial color={BAG} roughness={0.9} />
      </mesh>
    </group>
  )
}
