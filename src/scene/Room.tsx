import { useMemo, useRef } from 'react'
import { RoundedBox, Sparkles } from '@react-three/drei'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { RoomPalette } from '../theme'

// The stylized isometric lounge — now much bigger, split into zones:
//  • back wall: a row of arcade cabinets + a big wall screen + neon signage
//  • left wall: a row of workstation desks
//  • front-right: a sitting area (sofa / armchair / beanbag / coffee table) on a rug
//  • center: an open accent rug where bots mingle
// Everything is flat, geometric, low-poly. Colors come from the theme palette.
// A soft radial-gradient sprite (white → transparent), tinted per-use. Used as
// additive "glow pooling" so neon sources spill light onto the floor and wall.
function makeGlowTexture(): THREE.Texture {
  const s = 128
  const c = document.createElement('canvas')
  c.width = c.height = s
  const ctx = c.getContext('2d')!
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2)
  g.addColorStop(0, 'rgba(255,255,255,1)')
  g.addColorStop(0.45, 'rgba(255,255,255,0.32)')
  g.addColorStop(1, 'rgba(255,255,255,0)')
  ctx.fillStyle = g
  ctx.fillRect(0, 0, s, s)
  const tex = new THREE.CanvasTexture(c)
  tex.needsUpdate = true
  return tex
}

function GlowDecal({
  tex,
  position,
  size,
  color,
  opacity = 0.5,
  wall = false,
}: {
  tex: THREE.Texture
  position: [number, number, number]
  size: [number, number]
  color: string
  opacity?: number
  wall?: boolean
}) {
  return (
    <mesh position={position} rotation-x={wall ? 0 : -Math.PI / 2} renderOrder={1}>
      <planeGeometry args={size} />
      <meshBasicMaterial
        map={tex}
        color={color}
        transparent
        opacity={opacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  )
}

export function Room({ p }: { p: RoomPalette }) {
  const glow = useMemo(makeGlowTexture, [])
  return (
    <group>
      {/* floor */}
      <mesh position={[0, -0.05, 0]}>
        <boxGeometry args={[22, 0.1, 18]} />
        <meshStandardMaterial color={p.floor} roughness={0.95} />
      </mesh>

      {/* rugs */}
      <RoundedBox args={[7.6, 0.05, 5.6]} radius={0.12} smoothness={2} position={[4, 0.03, 2.4]}>
        <meshStandardMaterial color={p.rug} roughness={1} />
      </RoundedBox>
      <mesh rotation-x={-Math.PI / 2} position={[-0.4, 0.035, -0.2]}>
        <circleGeometry args={[2.5, 48]} />
        <meshStandardMaterial color={p.rug} roughness={1} />
      </mesh>
      {/* cool "work zone" runner grounding the desks along the left wall */}
      <RoundedBox args={[3.4, 0.04, 8.6]} radius={0.12} smoothness={2} position={[-8.7, 0.03, 0]}>
        <meshStandardMaterial color={p.zoneWork} roughness={1} />
      </RoundedBox>

      {/* walls */}
      <mesh position={[0, 2.75, -9.15]}>
        <boxGeometry args={[22, 5.6, 0.3]} />
        <meshStandardMaterial color={p.wallBack} roughness={1} />
      </mesh>
      <mesh position={[-11.15, 2.75, 0]}>
        <boxGeometry args={[0.3, 5.6, 18]} />
        <meshStandardMaterial color={p.wallLeft} roughness={1} />
      </mesh>
      {/* baseboards */}
      <mesh position={[0, 0.16, -9.0]}>
        <boxGeometry args={[22, 0.32, 0.14]} />
        <meshStandardMaterial color={p.frame} roughness={1} />
      </mesh>
      <mesh position={[-11.0, 0.16, 0]}>
        <boxGeometry args={[0.14, 0.32, 18]} />
        <meshStandardMaterial color={p.frame} roughness={1} />
      </mesh>

      {/* neon LED cove near the top of each wall */}
      <mesh position={[0, 4.7, -9.0]}>
        <boxGeometry args={[21.6, 0.1, 0.1]} />
        <meshStandardMaterial color={p.cove} emissive={p.cove} emissiveIntensity={1.1} toneMapped={false} />
      </mesh>
      <mesh position={[-10.98, 4.7, 0]}>
        <boxGeometry args={[0.1, 0.1, 17.6]} />
        <meshStandardMaterial color={p.cove} emissive={p.cove} emissiveIntensity={1.1} toneMapped={false} />
      </mesh>

      {/* big wall screen + neon sign (right half of back wall) */}
      <WallScreen p={p} />
      <NeonSign color={p.neonA} position={[4, 4.35, -8.95]} w={4.4} />
      {/* framed art on the left wall */}
      <Frame position={[-10.83, 3.4, -6]} p={p} />
      <Frame position={[-10.83, 3.4, 6]} p={p} small />

      {/* arcade cabinets (left half of back wall) */}
      <Arcade position={[-6, 0, -8.3]} neon={p.neonA} p={p} />
      <Arcade position={[-3.4, 0, -8.3]} neon={p.neonB} p={p} />
      <Arcade position={[-0.8, 0, -8.3]} neon={p.neonC} p={p} />

      {/* workstation desks along the left wall (monitors face into the room) */}
      <Desk position={[-10.3, 0, -3.2]} rotation={Math.PI / 2} p={p} />
      <Desk position={[-10.3, 0, 0]} rotation={Math.PI / 2} p={p} />
      <Desk position={[-10.3, 0, 3.2]} rotation={Math.PI / 2} p={p} />

      {/* sitting area */}
      <Sofa p={p} />
      <Armchair p={p} />
      <Beanbag p={p} />
      <CoffeeTable p={p} />

      {/* props */}
      <PoolTable position={[7.6, 0, -1.6]} p={p} />
      <VendingMachine position={[8.7, 0, -7.4]} p={p} />

      {/* plants */}
      <Plant position={[10.0, 0, -8]} p={p} />
      <Plant position={[-10.2, 0, 7]} p={p} />
      <Plant position={[9.6, 0, 7]} p={p} small />

      {/* neon light spill — additive glow pooling on the floor + bleeding onto
          the back wall under each emissive source (bloom amplifies it) */}
      <GlowDecal tex={glow} position={[4, 0.05, -7.4]} size={[9, 6]} color={p.neonC} opacity={0.58} />
      <GlowDecal tex={glow} position={[4, 2.7, -8.8]} size={[7.4, 4.9]} color={p.neonC} opacity={0.4} wall />
      <GlowDecal tex={glow} position={[-6, 0.05, -7.4]} size={[3, 3]} color={p.neonA} opacity={0.55} />
      <GlowDecal tex={glow} position={[-3.4, 0.05, -7.4]} size={[3, 3]} color={p.neonB} opacity={0.55} />
      <GlowDecal tex={glow} position={[-0.8, 0.05, -7.4]} size={[3, 3]} color={p.neonC} opacity={0.55} />

      {/* floating dust motes */}
      <Sparkles count={60} scale={[20, 6, 15]} position={[0, 3, -1]} size={2.4} speed={0.3} color={p.cove} opacity={0.5} />
    </group>
  )
}

function neonMat(color: string, i = 0.9) {
  return <meshStandardMaterial color={color} emissive={color} emissiveIntensity={i} toneMapped={false} />
}

function Arcade({
  position,
  neon,
  p,
}: {
  position: [number, number, number]
  neon: string
  p: RoomPalette
}) {
  return (
    <group position={position}>
      <RoundedBox args={[1.1, 1.9, 0.85]} radius={0.07} smoothness={2} position={[0, 0.95, 0]}>
        <meshStandardMaterial color={p.cabinet} roughness={0.55} />
      </RoundedBox>
      {/* marquee */}
      <mesh position={[0, 1.98, 0.18]}>
        <boxGeometry args={[1.12, 0.34, 0.55]} />
        <meshStandardMaterial color={p.cabinetTop} roughness={0.5} />
      </mesh>
      <mesh position={[0, 1.98, 0.47]}>
        <boxGeometry args={[0.96, 0.24, 0.03]} />
        {neonMat(neon, 1.2)}
      </mesh>
      {/* screen */}
      <mesh position={[0, 1.46, 0.44]} rotation-x={-0.22}>
        <boxGeometry args={[0.92, 0.72, 0.05]} />
        <meshStandardMaterial color="#0c0a17" roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.47, 0.47]} rotation-x={-0.22}>
        <boxGeometry args={[0.78, 0.58, 0.02]} />
        {neonMat(neon, 1.05)}
      </mesh>
      {/* control panel */}
      <mesh position={[0, 0.98, 0.5]} rotation-x={0.62}>
        <boxGeometry args={[0.98, 0.46, 0.05]} />
        <meshStandardMaterial color={p.cabinetTop} roughness={0.5} />
      </mesh>
      <mesh position={[-0.22, 1.05, 0.62]}>
        <cylinderGeometry args={[0.03, 0.03, 0.14, 8]} />
        <meshStandardMaterial color="#15121f" />
      </mesh>
      <mesh position={[-0.22, 1.12, 0.62]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        {neonMat(p.neonB, 0.7)}
      </mesh>
      {[0.05, 0.18, 0.31].map((bx, i) => (
        <mesh key={bx} position={[bx, 1.06, 0.6]} rotation-x={0.62}>
          <cylinderGeometry args={[0.035, 0.035, 0.05, 10]} />
          {neonMat([p.neonA, p.neonC, neon][i], 0.7)}
        </mesh>
      ))}
      {/* side glow */}
      {[-0.56, 0.56].map((sx) => (
        <mesh key={sx} position={[sx, 0.95, 0]}>
          <boxGeometry args={[0.03, 1.6, 0.5]} />
          {neonMat(neon, 0.5)}
        </mesh>
      ))}
    </group>
  )
}

const TV_BARS = [-1.6, -1.07, -0.53, 0, 0.53, 1.07, 1.6]

// The big wall screen with a live "equalizer" playing on it (bars bounce),
// which — with bloom — reads as content on the screen.
function WallScreen({ p }: { p: RoomPalette }) {
  const bars = useRef<THREE.Group>(null)
  useFrame(({ clock }) => {
    const g = bars.current
    if (!g) return
    const t = clock.elapsedTime
    g.children.forEach((c, i) => {
      const s = 0.3 + (Math.sin(t * 3.2 + i * 0.8) * 0.5 + 0.5) * 1.5
      c.scale.y = s
      c.position.y = -0.95 + s * 0.5
    })
  })
  const barColors = [p.neonA, p.neonB, p.neonC]
  return (
    <group position={[4, 2.7, -8.98]}>
      <mesh>
        <boxGeometry args={[5.2, 3.0, 0.14]} />
        <meshStandardMaterial color={p.screen} roughness={0.4} />
      </mesh>
      <mesh position={[0, 0, 0.07]}>
        <boxGeometry args={[4.7, 2.5, 0.04]} />
        {neonMat(p.neonC, 0.3)}
      </mesh>
      <group ref={bars} position={[0, 0, 0.12]}>
        {TV_BARS.map((x, i) => (
          <mesh key={x} position={[x, -0.5, 0]}>
            <boxGeometry args={[0.42, 1, 0.05]} />
            {neonMat(barColors[i % 3], 1.0)}
          </mesh>
        ))}
      </group>
    </group>
  )
}

function VendingMachine({ position, p }: { position: [number, number, number]; p: RoomPalette }) {
  return (
    <group position={position}>
      <RoundedBox args={[1.2, 2.2, 0.85]} radius={0.08} smoothness={2} position={[0, 1.1, 0]}>
        <meshStandardMaterial color={p.cabinet} roughness={0.55} />
      </RoundedBox>
      <mesh position={[0, 1.35, 0.44]}>
        <boxGeometry args={[0.86, 1.3, 0.04]} />
        {neonMat(p.neonC, 0.7)}
      </mesh>
      {/* product shelves (dark dividers over the glow) */}
      {[-0.4, -0.05, 0.3, 0.65].map((y) => (
        <mesh key={y} position={[0, 1.35 + y, 0.46]}>
          <boxGeometry args={[0.86, 0.06, 0.03]} />
          <meshStandardMaterial color="#0c0a17" />
        </mesh>
      ))}
      {/* dispenser slot */}
      <mesh position={[0, 0.45, 0.44]}>
        <boxGeometry args={[0.6, 0.28, 0.05]} />
        <meshStandardMaterial color="#0c0a17" />
      </mesh>
    </group>
  )
}

function PoolTable({ position, p }: { position: [number, number, number]; p: RoomPalette }) {
  const balls: [number, number, string][] = [
    [-0.5, -0.2, '#f5f2e8'],
    [-0.2, 0.1, p.neonB],
    [0.1, -0.1, p.neonC],
    [0.35, 0.18, '#f5a524'],
    [0.6, -0.05, p.neonA],
  ]
  return (
    <group position={position}>
      <RoundedBox args={[2.9, 0.34, 1.7]} radius={0.08} smoothness={2} position={[0, 0.68, 0]}>
        <meshStandardMaterial color={p.wood} roughness={0.6} />
      </RoundedBox>
      <mesh position={[0, 0.87, 0]}>
        <boxGeometry args={[2.5, 0.05, 1.32]} />
        <meshStandardMaterial color="#2f9f66" roughness={0.95} />
      </mesh>
      {[
        [-1.25, -0.7],
        [1.25, -0.7],
        [-1.25, 0.7],
        [1.25, 0.7],
      ].map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, 0.28, z]}>
          <boxGeometry args={[0.16, 0.56, 0.16]} />
          <meshStandardMaterial color={p.cabinetTop} roughness={0.6} />
        </mesh>
      ))}
      {balls.map(([x, z, c], i) => (
        <mesh key={i} position={[x, 0.94, z]}>
          <sphereGeometry args={[0.08, 16, 16]} />
          <meshStandardMaterial color={c} roughness={0.35} />
        </mesh>
      ))}
    </group>
  )
}

function NeonSign({ color, position, w }: { color: string; position: [number, number, number]; w: number }) {
  return (
    <group position={position}>
      <mesh>
        <boxGeometry args={[w, 0.5, 0.06]} />
        {neonMat(color, 1.2)}
      </mesh>
      <mesh position={[0, 0, -0.05]}>
        <boxGeometry args={[w + 0.3, 0.8, 0.06]} />
        <meshStandardMaterial color="#12101f" roughness={0.6} />
      </mesh>
    </group>
  )
}

function Desk({
  position,
  rotation = 0,
  p,
}: {
  position: [number, number, number]
  rotation?: number
  p: RoomPalette
}) {
  return (
    <group position={position} rotation-y={rotation}>
      <RoundedBox args={[2.0, 0.1, 1.0]} radius={0.03} smoothness={2} position={[0, 0.92, 0]}>
        <meshStandardMaterial color={p.desk} roughness={0.8} />
      </RoundedBox>
      {[
        [-0.9, -0.42],
        [0.9, -0.42],
        [-0.9, 0.42],
        [0.9, 0.42],
      ].map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, 0.46, z]}>
          <boxGeometry args={[0.09, 0.92, 0.09]} />
          <meshStandardMaterial color={p.desk} roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 1.08, -0.32]}>
        <boxGeometry args={[0.08, 0.22, 0.08]} />
        <meshStandardMaterial color={p.screen} />
      </mesh>
      <mesh position={[0, 1.46, -0.32]}>
        <boxGeometry args={[1.0, 0.6, 0.05]} />
        <meshStandardMaterial color={p.screen} roughness={0.4} />
      </mesh>
      <mesh position={[0, 1.46, -0.29]}>
        <boxGeometry args={[0.9, 0.5, 0.02]} />
        {neonMat(p.neonA, 1.1)}
      </mesh>
      <RoundedBox args={[0.72, 0.04, 0.24]} radius={0.02} smoothness={2} position={[0, 0.98, 0.2]}>
        <meshStandardMaterial color={p.frame} roughness={0.6} />
      </RoundedBox>
    </group>
  )
}

function Sofa({ p }: { p: RoomPalette }) {
  // Faces -z (toward the wall screen); backrest on the +z side.
  return (
    <group position={[4, 0, 3.2]}>
      <RoundedBox args={[3.6, 0.5, 1.5]} radius={0.14} smoothness={2} position={[0, 0.3, 0]}>
        <meshStandardMaterial color={p.sofa} roughness={1} />
      </RoundedBox>
      <RoundedBox args={[3.6, 0.95, 0.45]} radius={0.14} smoothness={2} position={[0, 0.72, 0.55]}>
        <meshStandardMaterial color={p.sofa} roughness={1} />
      </RoundedBox>
      {[-1.65, 1.65].map((x) => (
        <RoundedBox key={x} args={[0.45, 0.72, 1.5]} radius={0.1} smoothness={2} position={[x, 0.5, 0]}>
          <meshStandardMaterial color={p.sofa} roughness={1} />
        </RoundedBox>
      ))}
      {[-1.05, 0, 1.05].map((x) => (
        <RoundedBox key={x} args={[1.0, 0.26, 1.35]} radius={0.12} smoothness={2} position={[x, 0.6, -0.05]}>
          <meshStandardMaterial color={p.sofaCushion} roughness={1} />
        </RoundedBox>
      ))}
    </group>
  )
}

function Armchair({ p }: { p: RoomPalette }) {
  return (
    <group position={[7.9, 0, 3.7]} rotation-y={0.5}>
      <RoundedBox args={[1.5, 0.5, 1.5]} radius={0.14} smoothness={2} position={[0, 0.3, 0]}>
        <meshStandardMaterial color={p.sofa} roughness={1} />
      </RoundedBox>
      <RoundedBox args={[1.5, 0.95, 0.45]} radius={0.14} smoothness={2} position={[0, 0.75, 0.55]}>
        <meshStandardMaterial color={p.sofa} roughness={1} />
      </RoundedBox>
      <RoundedBox args={[1.3, 0.26, 1.3]} radius={0.12} smoothness={2} position={[0, 0.6, -0.05]}>
        <meshStandardMaterial color={p.sofaCushion} roughness={1} />
      </RoundedBox>
      {[-0.6, 0.6].map((x) => (
        <RoundedBox key={x} args={[0.28, 0.6, 1.5]} radius={0.09} smoothness={2} position={[x, 0.5, 0]}>
          <meshStandardMaterial color={p.sofa} roughness={1} />
        </RoundedBox>
      ))}
    </group>
  )
}

function Beanbag({ p }: { p: RoomPalette }) {
  return (
    <mesh position={[1.3, 0.42, 4.9]} scale={[1, 0.72, 1]}>
      <sphereGeometry args={[0.85, 22, 18]} />
      <meshStandardMaterial color={p.sofaCushion} roughness={1} />
    </mesh>
  )
}

function CoffeeTable({ p }: { p: RoomPalette }) {
  return (
    <group position={[4, 0, 1.0]}>
      <RoundedBox args={[2.6, 0.14, 1.3]} radius={0.06} smoothness={2} position={[0, 0.5, 0]}>
        <meshStandardMaterial color={p.wood} roughness={0.7} />
      </RoundedBox>
      {[
        [-1.1, -0.5],
        [1.1, -0.5],
        [-1.1, 0.5],
        [1.1, 0.5],
      ].map(([x, z]) => (
        <mesh key={`${x},${z}`} position={[x, 0.25, z]}>
          <boxGeometry args={[0.12, 0.5, 0.12]} />
          <meshStandardMaterial color={p.wood} roughness={0.7} />
        </mesh>
      ))}
    </group>
  )
}

function Frame({
  position,
  p,
  small = false,
}: {
  position: [number, number, number]
  p: RoomPalette
  small?: boolean
}) {
  const w = small ? 1.2 : 1.9
  const h = small ? 1.2 : 1.4
  return (
    <group position={position} rotation-y={Math.PI / 2}>
      <mesh>
        <boxGeometry args={[w, h, 0.08]} />
        <meshStandardMaterial color={p.frame} roughness={1} />
      </mesh>
      <mesh position={[0, 0, 0.05]}>
        <boxGeometry args={[w - 0.24, h - 0.24, 0.02]} />
        {neonMat(p.neonB, 0.3)}
      </mesh>
    </group>
  )
}

function Plant({
  position,
  p,
  small = false,
}: {
  position: [number, number, number]
  p: RoomPalette
  small?: boolean
}) {
  const s = small ? 0.8 : 1.1
  return (
    <group position={position} scale={s}>
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[0.32, 0.26, 0.6, 14]} />
        <meshStandardMaterial color={p.plantPot} roughness={0.9} />
      </mesh>
      <mesh position={[0, 1.02, 0]}>
        <sphereGeometry args={[0.56, 14, 12]} />
        <meshStandardMaterial color={p.plantLeaf} roughness={1} flatShading />
      </mesh>
      <mesh position={[0.3, 1.3, 0.14]}>
        <sphereGeometry args={[0.36, 12, 10]} />
        <meshStandardMaterial color={p.plantLeaf} roughness={1} flatShading />
      </mesh>
      <mesh position={[-0.28, 1.34, -0.12]}>
        <sphereGeometry args={[0.32, 12, 10]} />
        <meshStandardMaterial color={p.plantLeaf} roughness={1} flatShading />
      </mesh>
    </group>
  )
}
