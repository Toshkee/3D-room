import type * as THREE from 'three'
import type { Status } from '../types'

// Shared, mutated-in-place scene state. Created once per canvas and handed to
// every bot, the furniture that reacts to bots (desk monitors + lamps, arcade
// screens, the door), the camera and the conversation conductor. Lives outside
// React state on purpose: it changes every frame.

export interface Agent {
  pos: THREE.Vector3
  /** Last graph node the bot actually reached. */
  node: string
  /** Where it's heading (== node while dwelling). */
  dest: string
  moving: boolean
  /** Sitting or mid-conversation — others step around it rather than push it. */
  anchored: boolean
  status: Status
  selected: boolean
  /** Walking in through the door (not yet available for conversations). */
  entering: boolean
  /** Bot id this bot should walk over to and talk with. */
  visit: string | null
  talkWith: string | null
  talkUntil: number
  /** Someone's on their way over — stay put until this clock time. */
  holdUntil: number
  lastTalk: number
}

export interface World {
  /** botId → live position (also read by the camera to follow a selection). */
  positions: Record<string, THREE.Vector3>
  /** nodeId → botId currently there or heading there. */
  claim: Record<string, string>
  agents: Record<string, Agent>
  /** nodeId → the bot actively using it (desk, arcade…) and its accent. */
  using: Record<string, { id: string; accent: string }>
  /** Clock time until which the door stays open. */
  doorOpenUntil: number
}

export function createWorld(): World {
  return { positions: {}, claim: {}, agents: {}, using: {}, doorOpenUntil: -1 }
}

/** Start a conversation between two bots (both face each other for a while). */
export function startTalk(w: World, a: string, b: string, t: number, secs: number) {
  const A = w.agents[a]
  const B = w.agents[b]
  if (!A || !B) return
  A.talkWith = b
  B.talkWith = a
  A.talkUntil = B.talkUntil = t + secs
  B.holdUntil = Math.max(B.holdUntil, t + secs)
}
