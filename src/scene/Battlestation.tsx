import { useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { HEX, PALETTE } from '../theme'
import { useTapSelect } from '../useTapSelect'

type Props = {
  position: [number, number]
  faceY: number
  /** Monitor + RGB glow color. */
  hex: number
  /** Dim, empty "Reserved" desk — selectable (opens the add-slot card). */
  reserved?: boolean
  selected?: boolean
  reduced?: boolean
  onSelect?: (id: string) => void
}

/**
 * A battlestation — desk + gaming chair + glowing monitor + peripherals + RGB
 * underglow. Set dressing for the arena (the gamers stand, they don't sit here).
 * The reserved desk is dim and selectable (it opens the "Reserved" card); the
 * others just glow ambiently.
 *
 * Local space: +Z is "forward" (the desk + camera-facing monitor live at +Z).
 */
export function Battlestation({ position, faceY, hex, reserved, selected, reduced, onSelect }: Props) {
  const [x, z] = position
  const screenMat = useRef<THREE.MeshStandardMaterial>(null)
  const rgbMat = useRef<THREE.MeshStandardMaterial>(null)
  const invalidate = useThree((s) => s.invalidate)

  // Only the reserved desk is interactive.
  const { hovered, handlers } = useTapSelect('add-slot', onSelect ?? (() => {}))
  const active = !!reserved && (hovered || !!selected)
  const glow = useRef(reserved ? 0.12 : 1)

  useFrame(() => {
    const target = reserved ? (active ? 1.5 : 0.12) : 1
    glow.current = THREE.MathUtils.lerp(glow.current, target, reduced ? 1 : 0.1)
    if (screenMat.current) screenMat.current.emissiveIntensity = (reserved ? 0.1 : 2.1) * glow.current
    if (rgbMat.current) rgbMat.current.emissiveIntensity = (reserved ? 0.2 : 2.4) * glow.current
    if (reduced && Math.abs(glow.current - target) > 1e-3) invalidate()
  })

  const screenColor = reserved ? '#0b0a0f' : hex

  return (
    <group position={[x, 0, z]} rotation={[0, faceY, 0]}>
      {/* ---- gaming chair ---- */}
      <group position={[0, 0, -0.04]}>
        <mesh castShadow position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.33, 0.36, 0.06, 5]} />
          <meshStandardMaterial color={HEX.plasticDark} metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh castShadow position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.04, 0.05, 0.42, 12]} />
          <meshStandardMaterial color={HEX.metal} metalness={0.8} roughness={0.35} />
        </mesh>
        <mesh castShadow position={[0, 0.5, 0]}>
          <boxGeometry args={[0.52, 0.1, 0.5]} />
          <meshStandardMaterial color={HEX.chair} metalness={0.1} roughness={0.7} />
        </mesh>
        <mesh castShadow position={[0, 0.95, -0.26]} rotation={[-0.12, 0, 0]}>
          <boxGeometry args={[0.52, 0.92, 0.1]} />
          <meshStandardMaterial color={HEX.chair} metalness={0.1} roughness={0.7} />
        </mesh>
        <mesh position={[0, 0.95, -0.205]} rotation={[-0.12, 0, 0]}>
          <boxGeometry args={[0.4, 0.84, 0.012]} />
          <meshStandardMaterial color={hex} emissive={hex} emissiveIntensity={0.5} roughness={0.5} toneMapped={false} />
        </mesh>
        {[-0.31, 0.31].map((ax) => (
          <mesh key={ax} castShadow position={[ax, 0.62, 0.02]}>
            <boxGeometry args={[0.07, 0.05, 0.32]} />
            <meshStandardMaterial color={HEX.plasticDark} roughness={0.6} />
          </mesh>
        ))}
      </group>

      {/* ---- desk ---- */}
      <group position={[0, 0, 0.62]}>
        <mesh castShadow receiveShadow position={[0, 0.74, 0]}>
          <boxGeometry args={[1.7, 0.04, 0.62]} />
          <meshStandardMaterial color={HEX.deskTop} metalness={0.2} roughness={0.45} />
        </mesh>
        {[
          [-0.8, 0.27],
          [0.8, 0.27],
          [-0.8, -0.27],
          [0.8, -0.27],
        ].map(([lx, lz], i) => (
          <mesh key={i} castShadow position={[lx, 0.37, lz]}>
            <boxGeometry args={[0.05, 0.74, 0.05]} />
            <meshStandardMaterial color={HEX.metal} metalness={0.7} roughness={0.4} />
          </mesh>
        ))}
        {/* RGB strip under the front lip → floor underglow */}
        <mesh position={[0, 0.71, -0.3]}>
          <boxGeometry args={[1.62, 0.018, 0.02]} />
          <meshStandardMaterial ref={rgbMat} color={hex} emissive={hex} emissiveIntensity={2.4} toneMapped={false} roughness={0.4} />
        </mesh>

        {/* monitor on a stand, screen facing the camera (+Z) */}
        <group position={[0, 0.76, 0.06]}>
          <mesh castShadow position={[0, 0.06, 0.06]}>
            <boxGeometry args={[0.16, 0.12, 0.12]} />
            <meshStandardMaterial color={HEX.plasticDark} roughness={0.5} />
          </mesh>
          <mesh castShadow position={[0, 0.32, 0.02]}>
            <boxGeometry args={[1.0, 0.42, 0.04]} />
            <meshStandardMaterial color={HEX.plasticDark} metalness={0.3} roughness={0.5} />
          </mesh>
          <mesh position={[0, 0.32, 0.042]}>
            <planeGeometry args={[0.94, 0.36]} />
            <meshStandardMaterial ref={screenMat} color={screenColor} emissive={screenColor} emissiveIntensity={reserved ? 0.1 : 2.1} toneMapped={false} roughness={0.2} />
          </mesh>
        </group>

        {/* keyboard + mouse */}
        <mesh castShadow position={[0, 0.765, -0.12]}>
          <boxGeometry args={[0.46, 0.025, 0.15]} />
          <meshStandardMaterial color={HEX.plasticDark} roughness={0.5} />
        </mesh>
        <mesh position={[0, 0.778, -0.12]}>
          <boxGeometry args={[0.44, 0.004, 0.13]} />
          <meshStandardMaterial color={hex} emissive={hex} emissiveIntensity={0.7} toneMapped={false} />
        </mesh>
        <mesh castShadow position={[0.34, 0.768, -0.1]}>
          <boxGeometry args={[0.06, 0.03, 0.1]} />
          <meshStandardMaterial color={HEX.plasticDark} roughness={0.5} />
        </mesh>

        {/* mug */}
        <mesh castShadow position={[-0.66, 0.82, -0.02]}>
          <cylinderGeometry args={[0.05, 0.045, 0.1, 16]} />
          <meshStandardMaterial color={HEX.metal} metalness={0.2} roughness={0.5} />
        </mesh>

        {/* headset on a stand at the desk corner */}
        <group position={[0.74, 0.76, 0.04]}>
          <mesh castShadow position={[0, 0.12, 0]}>
            <cylinderGeometry args={[0.012, 0.012, 0.24, 8]} />
            <meshStandardMaterial color={HEX.metal} metalness={0.7} roughness={0.4} />
          </mesh>
          <mesh position={[0, 0.26, 0]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.07, 0.018, 8, 20, Math.PI]} />
            <meshStandardMaterial color={HEX.plasticDark} roughness={0.5} />
          </mesh>
          {[-0.07, 0.07].map((ex) => (
            <mesh key={ex} position={[ex, 0.2, 0]}>
              <cylinderGeometry args={[0.03, 0.03, 0.03, 14]} />
              <meshStandardMaterial color={hex} emissive={hex} emissiveIntensity={0.6} toneMapped={false} />
            </mesh>
          ))}
        </group>
      </group>

      {/* the reserved desk advertises itself + is clickable */}
      {reserved && (
        <>
          <Billboard position={[0, 1.62, 0.4]}>
            <Text
              fontSize={0.17}
              color={active ? PALETTE.muted : PALETTE.ink}
              anchorX="center"
              anchorY="middle"
              letterSpacing={0.03}
              outlineWidth={0.012}
              outlineColor={'#05040a'}
              fillOpacity={active ? 1 : 0.78}
            >
              Reserved
            </Text>
          </Billboard>
          <mesh position={[0, 0.95, 0.35]} {...handlers}>
            <boxGeometry args={[1.9, 1.95, 1.7]} />
            <meshBasicMaterial transparent opacity={0} depthWrite={false} />
          </mesh>
        </>
      )}
    </group>
  )
}
