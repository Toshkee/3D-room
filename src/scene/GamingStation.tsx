import { useRef, useState } from 'react'
import { useFrame, useThree, type ThreeEvent } from '@react-three/fiber'
import { Billboard, Text } from '@react-three/drei'
import * as THREE from 'three'
import { HEX, PALETTE } from '../theme'
import { GamerCharacter } from './GamerCharacter'
import type { Project } from '../data/projects'

// tap-vs-drag guard (touch gets a more generous slop)
const TAP_PX = 9
const TAP_PX_TOUCH = 16
const TAP_MS = 500

// Bot fit on the gaming chair — tuned visually. The "Sitting" clip is a floor
// sit; raised to seat height it reads as sitting on the chair, chair beneath.
const BOT_SCALE = 0.3
const BOT_POS: [number, number, number] = [0, 0.44, -0.05]

type Props = {
  project: Project
  /** Floor position [x, z] of the seat. */
  position: [number, number]
  /** Yaw that turns the whole station toward the room center. */
  faceY: number
  selected: boolean
  reduced: boolean
  phase: number
  onSelect: (id: string) => void
}

/**
 * One gamer's spot: gaming chair + desk + monitor + peripherals + RGB underglow,
 * a seated bot tinted to the project accent, and a floating nameplate. The whole
 * group is the click target that selects the project.
 *
 * Local space: +Z is "forward" (where the gamer looks); the desk + monitor live
 * at +Z, the chair sits under the gamer, its back toward -Z.
 */
export function GamingStation({
  project,
  position,
  faceY,
  selected,
  reduced,
  phase,
  onSelect,
}: Props) {
  const { id, name, hex, css, add } = project
  const [x, z] = position

  const [hovered, setHovered] = useState(false)
  const active = hovered || selected
  const invalidate = useThree((s) => s.invalidate)

  const screenMat = useRef<THREE.MeshStandardMaterial>(null)
  const rgbMat = useRef<THREE.MeshStandardMaterial>(null)
  const glow = useRef(add ? 0.12 : 1)

  // --- tap-vs-drag guard ---
  const down = useRef<{ x: number; y: number; t: number; touch: boolean } | null>(null)
  const onDown = (e: ThreeEvent<PointerEvent>) => {
    down.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, touch: e.pointerType !== 'mouse' }
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const d = down.current
    down.current = null
    if (!d) return
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y)
    if (moved > (d.touch ? TAP_PX_TOUCH : TAP_PX) || e.timeStamp - d.t > TAP_MS) return
    e.stopPropagation()
    onSelect(id)
  }
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    // The reserved slot is clickable too (it opens its "Reserved" card and the
    // keyboard nav advertises it), so give the same hover affordance.
    e.stopPropagation()
    setHovered(true)
    document.body.style.cursor = 'pointer'
  }
  const onOut = () => {
    setHovered(false)
    document.body.style.cursor = 'auto'
  }

  useFrame((state) => {
    const t = state.clock.elapsedTime
    const target = add ? 0.12 : active ? 1.7 : 1
    glow.current = THREE.MathUtils.lerp(glow.current, target, reduced ? 1 : 0.1)
    const flick = reduced || add ? 1 : 0.96 + 0.04 * Math.sin(t * 8 + phase)
    if (screenMat.current) screenMat.current.emissiveIntensity = 2.1 * glow.current * flick
    if (rgbMat.current) rgbMat.current.emissiveIntensity = 2.4 * glow.current
    if (reduced && Math.abs(glow.current - target) > 1e-3) invalidate()
  })

  return (
    <group position={[x, 0, z]} rotation={[0, faceY, 0]}>
      {/* ---- gaming chair ---- */}
      <group position={[0, 0, -0.04]}>
        {/* 5-star base + post */}
        <mesh castShadow position={[0, 0.05, 0]}>
          <cylinderGeometry args={[0.33, 0.36, 0.06, 5]} />
          <meshStandardMaterial color={HEX.plasticDark} metalness={0.5} roughness={0.5} />
        </mesh>
        <mesh castShadow position={[0, 0.3, 0]}>
          <cylinderGeometry args={[0.04, 0.05, 0.42, 12]} />
          <meshStandardMaterial color={HEX.metal} metalness={0.8} roughness={0.35} />
        </mesh>
        {/* seat */}
        <mesh castShadow position={[0, 0.5, 0]}>
          <boxGeometry args={[0.52, 0.1, 0.5]} />
          <meshStandardMaterial color={HEX.chair} metalness={0.1} roughness={0.7} />
        </mesh>
        {/* backrest (tilted) */}
        <mesh castShadow position={[0, 0.95, -0.26]} rotation={[-0.12, 0, 0]}>
          <boxGeometry args={[0.52, 0.92, 0.1]} />
          <meshStandardMaterial color={HEX.chair} metalness={0.1} roughness={0.7} />
        </mesh>
        {/* accent piping down the backrest */}
        <mesh position={[0, 0.95, -0.205]} rotation={[-0.12, 0, 0]}>
          <boxGeometry args={[0.4, 0.84, 0.012]} />
          <meshStandardMaterial color={hex} emissive={hex} emissiveIntensity={0.5} roughness={0.5} toneMapped={false} />
        </mesh>
        {/* armrests */}
        {[-0.31, 0.31].map((ax) => (
          <mesh key={ax} castShadow position={[ax, 0.62, 0.02]}>
            <boxGeometry args={[0.07, 0.05, 0.32]} />
            <meshStandardMaterial color={HEX.plasticDark} roughness={0.6} />
          </mesh>
        ))}
      </group>

      {/* ---- the gamer ---- */}
      {!add && (
        <group position={BOT_POS} scale={BOT_SCALE}>
          <GamerCharacter accent={hex} pose="Sitting" phase={phase} reduced={reduced} />
        </group>
      )}

      {/* ---- desk ---- */}
      <group position={[0, 0, 0.62]}>
        <mesh castShadow receiveShadow position={[0, 0.74, 0]}>
          <boxGeometry args={[1.7, 0.04, 0.62]} />
          <meshStandardMaterial color={HEX.deskTop} metalness={0.2} roughness={0.45} />
        </mesh>
        {/* legs */}
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
          <meshStandardMaterial
            ref={rgbMat}
            color={hex}
            emissive={hex}
            emissiveIntensity={2.4}
            toneMapped={false}
            roughness={0.4}
          />
        </mesh>

        {/* monitor on a stand, screen facing the gamer (-Z) */}
        <group position={[0, 0.76, 0.06]}>
          <mesh castShadow position={[0, 0.06, 0.06]}>
            <boxGeometry args={[0.16, 0.12, 0.12]} />
            <meshStandardMaterial color={HEX.plasticDark} roughness={0.5} />
          </mesh>
          <mesh castShadow position={[0, 0.32, 0.02]}>
            <boxGeometry args={[1.0, 0.42, 0.04]} />
            <meshStandardMaterial color={HEX.plasticDark} metalness={0.3} roughness={0.5} />
          </mesh>
          {/* emissive screen — on the camera-facing (+Z) side of the bezel so
              it isn't occluded by the chassis and its accent glow blooms */}
          <mesh position={[0, 0.32, 0.042]}>
            <planeGeometry args={[0.94, 0.36]} />
            <meshStandardMaterial
              ref={screenMat}
              color={add ? '#0b0a0f' : hex}
              emissive={add ? '#0b0a0f' : hex}
              emissiveIntensity={add ? 0.1 : 2.1}
              toneMapped={false}
              roughness={0.2}
            />
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

      {/* nameplate (faces camera) */}
      <Billboard position={[0, add ? 1.62 : 1.92, 0.4]}>
        <Text
          fontSize={0.17}
          color={active ? css : PALETTE.ink}
          anchorX="center"
          anchorY="middle"
          letterSpacing={0.03}
          outlineWidth={0.012}
          outlineColor={'#05040a'}
          fillOpacity={active ? 1 : 0.78}
        >
          {add ? 'Reserved' : name}
        </Text>
      </Billboard>

      {/* invisible click/hover target around the station */}
      <mesh
        position={[0, 0.95, 0.35]}
        onPointerOver={onOver}
        onPointerOut={onOut}
        onPointerDown={onDown}
        onClick={onClick}
      >
        <boxGeometry args={[1.9, 1.95, 1.7]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
    </group>
  )
}
