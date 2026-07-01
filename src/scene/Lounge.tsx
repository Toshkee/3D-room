import { HEX } from '../theme'
import { LOUNGE } from '../data/lounge'

const FABRIC = '#2c2733'
const FABRIC2 = '#332d3c'
const BEAN = '#37313f'
const BEAN2 = '#403949'

/**
 * The lounge "living room": a big rug, a 3-seat sofa, an accent armchair and a
 * floor beanbag around a low coffee table, set back near the wall screen. It's
 * set dressing now (the gamers walk in and stand up front), laid out from
 * `LOUNGE` (data/lounge.ts). Food + drinks (FoodDrinks) and lamps (Decor) dress
 * it further.
 *
 * Each piece is built in a local space where the occupant faces local +Z (the
 * backrest sits at local −Z) and is then rotated by its `faceY`.
 */
export function Lounge() {
  const { rug: R, table: T, sofa: S, armchair: A, beanbag: B } = LOUNGE

  return (
    <group>
      {/* rug under the whole nook */}
      <mesh position={[R.pos[0], 0.012, R.pos[1]]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[R.w, R.d]} />
        <meshStandardMaterial color={HEX.carpet} roughness={0.95} />
      </mesh>

      {/* ---- 3-seat sofa ---- */}
      <group position={[S.pos[0], 0, S.pos[1]]} rotation={[0, S.faceY, 0]}>
        <mesh castShadow receiveShadow position={[0, 0.26, 0.02]}>
          <boxGeometry args={[3.3, 0.4, 1.05]} />
          <meshStandardMaterial color={FABRIC} roughness={0.85} />
        </mesh>
        {[-S.seatGap, 0, S.seatGap].map((cx) => (
          <mesh key={cx} castShadow position={[cx, 0.5, 0.06]}>
            <boxGeometry args={[0.92, 0.18, 0.9]} />
            <meshStandardMaterial color={FABRIC2} roughness={0.8} />
          </mesh>
        ))}
        {/* backrest behind the occupants (local −Z) */}
        <mesh castShadow position={[0, 0.72, -0.46]}>
          <boxGeometry args={[3.3, 0.78, 0.22]} />
          <meshStandardMaterial color={FABRIC} roughness={0.85} />
        </mesh>
        {[-1.62, 1.62].map((ax) => (
          <mesh key={ax} castShadow position={[ax, 0.46, 0]}>
            <boxGeometry args={[0.22, 0.52, 1.05]} />
            <meshStandardMaterial color={FABRIC} roughness={0.85} />
          </mesh>
        ))}
      </group>

      {/* ---- accent armchair ---- */}
      <group position={[A.pos[0], 0, A.pos[1]]} rotation={[0, A.faceY, 0]}>
        <mesh castShadow receiveShadow position={[0, 0.26, 0.02]}>
          <boxGeometry args={[0.98, 0.4, 0.98]} />
          <meshStandardMaterial color={FABRIC2} roughness={0.85} />
        </mesh>
        <mesh castShadow position={[0, 0.5, 0.06]}>
          <boxGeometry args={[0.86, 0.16, 0.84]} />
          <meshStandardMaterial color={FABRIC} roughness={0.8} />
        </mesh>
        <mesh castShadow position={[0, 0.72, -0.42]}>
          <boxGeometry args={[0.98, 0.72, 0.18]} />
          <meshStandardMaterial color={FABRIC2} roughness={0.85} />
        </mesh>
        {[-0.49, 0.49].map((ax) => (
          <mesh key={ax} castShadow position={[ax, 0.44, 0]}>
            <boxGeometry args={[0.16, 0.4, 0.92]} />
            <meshStandardMaterial color={FABRIC2} roughness={0.85} />
          </mesh>
        ))}
        {[
          [-0.4, 0.4],
          [0.4, 0.4],
          [-0.4, -0.4],
          [0.4, -0.4],
        ].map(([lx, lz], i) => (
          <mesh key={i} castShadow position={[lx, 0.12, lz]}>
            <cylinderGeometry args={[0.03, 0.03, 0.24, 8]} />
            <meshStandardMaterial color={HEX.metal} metalness={0.6} roughness={0.5} />
          </mesh>
        ))}
      </group>

      {/* ---- floor beanbag ---- */}
      <group position={[B.pos[0], 0, B.pos[1]]} rotation={[0, B.faceY, 0]}>
        <mesh castShadow receiveShadow position={[0, 0.3, 0.05]} scale={[1, 0.6, 1.05]}>
          <sphereGeometry args={[0.56, 18, 14]} />
          <meshStandardMaterial color={BEAN} roughness={0.92} />
        </mesh>
        {/* raised back lump to support the recline */}
        <mesh castShadow position={[0, 0.52, -0.24]} scale={[1, 0.8, 1]}>
          <sphereGeometry args={[0.4, 16, 12]} />
          <meshStandardMaterial color={BEAN2} roughness={0.92} />
        </mesh>
      </group>

      {/* ---- coffee table ---- */}
      <group position={[T.pos[0], 0, T.pos[1]]}>
        <mesh castShadow receiveShadow position={[0, T.topY - 0.03, 0]}>
          <boxGeometry args={[T.w, 0.06, T.d]} />
          <meshStandardMaterial color={HEX.deskTop} metalness={0.2} roughness={0.4} />
        </mesh>
        {[
          [-T.w / 2 + 0.1, T.d / 2 - 0.1],
          [T.w / 2 - 0.1, T.d / 2 - 0.1],
          [-T.w / 2 + 0.1, -T.d / 2 + 0.1],
          [T.w / 2 - 0.1, -T.d / 2 + 0.1],
        ].map(([lx, lz], i) => (
          <mesh key={i} castShadow position={[lx, (T.topY - 0.06) / 2, lz]}>
            <boxGeometry args={[0.05, T.topY - 0.06, 0.05]} />
            <meshStandardMaterial color={HEX.metal} metalness={0.7} roughness={0.4} />
          </mesh>
        ))}
      </group>
    </group>
  )
}
