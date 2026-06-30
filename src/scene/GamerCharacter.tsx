import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF, useAnimations } from '@react-three/drei'
import { SkeletonUtils } from 'three-stdlib'
import * as THREE from 'three'
import { MODEL_URL } from '../theme'

useGLTF.preload(MODEL_URL)

export type Pose = 'Sitting' | 'Idle' | 'Wave' | 'ThumbsUp'

type Props = {
  /** Project accent — tints the bot's body (kept PBR, not flat neon). */
  accent: number
  pose?: Pose
  /** De-syncs the idle sway between bots. */
  phase?: number
  /** Freeze on a single pose frame under prefers-reduced-motion. */
  reduced?: boolean
}

/**
 * A RobotExpressive gamer-bot. The GLB is loaded once and skeleton-cloned per
 * instance so each has an independent skeleton + animation, then its "Main"
 * material is tinted to the project's accent color.
 */
export function GamerCharacter({ accent, pose = 'Sitting', phase = 0, reduced = false }: Props) {
  const { scene, animations } = useGLTF(MODEL_URL)
  const root = useRef<THREE.Group>(null)

  // Independent skinned clone (own skeleton) + per-instance accent tint.
  const cloned = useMemo(() => {
    const c = SkeletonUtils.clone(scene)
    c.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (!mesh.isMesh) return
      mesh.castShadow = true
      mesh.receiveShadow = true
      const mat = mesh.material as THREE.MeshStandardMaterial
      if (mat?.isMaterial && mat.name === 'Main') {
        const m = mat.clone()
        // Darken the accent so it reads as a colored plastic shell, not neon.
        m.color = new THREE.Color(accent).multiplyScalar(0.62)
        m.emissive = new THREE.Color(accent)
        m.emissiveIntensity = 0.08
        m.metalness = 0.15
        m.roughness = 0.5
        mesh.material = m
      }
    })
    return c
  }, [scene, accent])

  const { actions, mixer } = useAnimations(animations, root)

  useEffect(() => {
    const action = actions[pose] ?? actions.Idle ?? Object.values(actions)[0]
    if (!action) return
    action.reset()
    if (reduced) {
      // Apply the seated pose at FULL weight in the single static (demand-mode)
      // frame. Fading in here would evaluate weight 0 at mixer.update(0) and
      // freeze the bot in its standing bind pose.
      action.play()
      action.time = 1.4
      mixer.update(0)
      action.paused = true
    } else {
      action.fadeIn(0.4).play()
    }
    return () => {
      action.fadeOut(0.25)
    }
  }, [actions, mixer, pose, reduced])

  // A small extra idle sway layered over the clip (drei updates the mixer).
  useFrame((state) => {
    if (reduced || !root.current) return
    const t = state.clock.elapsedTime
    root.current.rotation.y = Math.sin(t * 0.45 + phase) * 0.04
  })

  return <primitive ref={root} object={cloned} />
}
