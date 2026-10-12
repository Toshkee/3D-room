import { memo, useEffect, useMemo, useRef, useState } from 'react'
import { Html, RoundedBox } from '@react-three/drei'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import type { Bot } from '../types'
import { SEATS } from '../data/bots'
import { ROAM, chooseGoal, dwellFor, nearestNode, node, pathTo, suits } from '../data/roam'
import { StatusPill } from '../components/StatusPill'
import { FolderGit2 } from '../components/icons'
import { hash01, mixHex } from '../util'
import { sceneBus } from '../state/sceneBus'
import { SpeechBubble } from './SpeechBubble'
import { startTalk, type World } from './world'

const EYE = '#8ff0ff'
const ATTENTION = new THREE.Color('#ffb020')
const LABEL_Y = 2.0

type Mode = 'dwell' | 'travel'

// What the body is doing right now — drives arm/head/lean targets + props.
type Pose =
  | 'stand'
  | 'walk'
  | 'sit'
  | 'type'
  | 'laptop'
  | 'think'
  | 'play'
  | 'pool'
  | 'read'
  | 'board'
  | 'buy'
  | 'talk'
  | 'listen'
  | 'wave'
  | 'cheer'
  | 'raise'

interface Base {
  aLx: number
  aLz: number
  aRx: number
  aRz: number
  hx: number
  hz: number
  lean: number
}
const KEYS: (keyof Base)[] = ['aLx', 'aLz', 'aRx', 'aRz', 'hx', 'hz', 'lean']

// Resting angles per pose (radians). Arms pivot at the shoulder: negative x
// swings an arm forward/up; z swings it out to the side (left arm out = −z,
// right arm out = +z). hx nods the head down, hz tilts it, lean tips the body.
const POSE_BASE: Record<Pose, Partial<Base>> = {
  stand: {},
  walk: {},
  sit: { aLx: -0.4, aRx: -0.4 },
  type: { aLx: -1.25, aRx: -1.25, lean: 0.12, hx: 0.14 },
  laptop: { aLx: -0.95, aRx: -0.95, lean: 0.08, hx: 0.26 },
  think: { aRx: -2.3, aRz: -0.45, hz: 0.16, hx: -0.05 },
  play: { aLx: -1.05, aRx: -1.05, lean: 0.06 },
  pool: { aLx: -1.35, aRx: -1.0, lean: 0.32, hx: 0.1 },
  read: { aLx: -1.2, aRx: -1.2, aLz: 0.28, aRz: -0.28, hx: 0.3 },
  board: { aRx: -2.35, aRz: 0.15, hz: 0.06 },
  buy: { aRx: -1.45, aRz: -0.1 },
  talk: { aLx: -0.45, aRx: -0.6 },
  listen: { hx: 0.06 },
  wave: { aRz: 2.6 },
  cheer: { aLz: -2.7, aRz: 2.7 },
  raise: { aRz: 2.95, aRx: -0.15, hx: -0.08 },
}

// Shared confetti burst for "done": a few glowing bits fly out of the head.
const SPARK_N = 10
const SPARK_GEO = new THREE.OctahedronGeometry(0.06)
const SPARK_DIRS = Array.from({ length: SPARK_N }, (_, i) => {
  const a = (i / SPARK_N) * Math.PI * 2
  const up = 0.9 + (i % 3) * 0.35
  return new THREE.Vector3(Math.cos(a) * 1.1, up * 1.6, Math.sin(a) * 1.1)
})
const SPARK_LIFE = 1.15

// Shorten a yaw delta to [-PI, PI] for smooth turning.
function shortAngle(a: number) {
  return Math.atan2(Math.sin(a), Math.cos(a))
}

// A cute low-poly robot that lives in the lounge. Where it goes and what its
// body does follows its STATUS, so the room reads at a glance:
//   working  → sits at a desk and types (its monitor + desk lamp take its
//              color), or works on a laptop on the sofa when desks are taken
//   thinking → paces slowly with a hand on its chin, browses the bookshelf,
//              scribbles on the whiteboard
//   idle     → arcades, pool, sofa, grabs a can from the vending machine
//   done     → hops with both arms up + a confetti burst
// Between runs it now and then walks over to another free bot for a chat (the
// Conductor pairs them; both face each other and gesture), waves when you
// select it, raises a hand when it needs your OK, shows a speech bubble with
// what it just said, and walks in through the door when its repo is added.
// All FSM state lives in refs — no React re-renders per frame. Memoized so a
// tick on one bot doesn't re-render every other bot's <Html> badge.
export const BotAvatar = memo(function BotAvatar({
  bot,
  selected,
  onSelect,
  reducedMotion,
  world,
}: {
  bot: Bot
  selected: boolean
  onSelect: (id: string) => void
  reducedMotion: boolean
  world: World
}) {
  const phase = hash01(bot.id) * Math.PI * 2

  const rootG = useRef<THREE.Group>(null)
  const scaleG = useRef<THREE.Group>(null)
  const bodyG = useRef<THREE.Group>(null)
  const headG = useRef<THREE.Group>(null)
  const armL = useRef<THREE.Group>(null)
  const armR = useRef<THREE.Group>(null)
  const eyeL = useRef<THREE.Mesh>(null)
  const eyeR = useRef<THREE.Mesh>(null)
  const tip = useRef<THREE.Mesh>(null)
  const ring = useRef<THREE.Mesh>(null)
  const laptop = useRef<THREE.Group>(null)
  const book = useRef<THREE.Mesh>(null)
  const can = useRef<THREE.Mesh>(null)
  const cue = useRef<THREE.Mesh>(null)
  const sparks = useRef<THREE.Group>(null)
  const tag = useRef<HTMLDivElement>(null)
  const down = useRef<{ x: number; y: number } | null>(null)
  const [hovered, setHovered] = useState(false)

  const headColor = mixHex(bot.accent, '#ffffff', 0.7)
  const armColor = mixHex(bot.accent, '#000000', 0.12)
  const bright = mixHex(bot.accent, '#ffffff', 0.25)
  const sparkMat = useMemo(() => {
    const m = new THREE.MeshBasicMaterial({ color: bright, transparent: true, toneMapped: false })
    m.color.multiplyScalar(2.2)
    return m
  }, [bright])
  useEffect(() => () => sparkMat.dispose(), [sparkMat])

  // --- FSM state (refs so it never triggers React re-renders) --------------
  const fsm = useRef({
    mode: 'dwell' as Mode,
    current: '',
    path: [] as string[],
    pi: 0,
    stopShort: 0,
    visitHost: '',
    waitFor: '',
    waitUntil: 0,
    dwellUntil: 0,
    fresh: true,
    pos: new THREE.Vector3(),
    inited: false,
    entering: false,
    lastStatus: bot.status,
    celebrateUntil: -1,
    burstAt: -99,
    waveUntil: -1,
    wasSelected: false,
    carryUntil: -1,
    keys: false,
    usingNode: '',
    tagHidden: false,
    base: { aLx: 0, aLz: 0, aRx: 0, aRz: 0, hx: 0, hz: 0, lean: 0 } as Base,
  })

  // Register in the shared world: position slot, agent record, a node claim.
  // New imports start in the corridor behind the door and walk in.
  useEffect(() => {
    const f = fsm.current
    const w = world
    const entering = sceneBus.isEntering(bot.id)
    const seat = SEATS[bot.seat] ?? SEATS[0]
    const near = nearestNode(seat[0], seat[1])
    const goal = chooseGoal(near, w.claim, bot.id, bot.status) ?? near
    let start = goal
    if (entering && !reducedMotion) {
      start = 'out'
      f.path = pathTo('out', goal)
      f.pi = 0
      f.mode = f.path.length ? 'travel' : 'dwell'
      f.entering = f.path.length > 0
    }
    const [sx, sz] = node(start).pos
    f.current = start
    f.pos.set(sx, 0, sz)
    f.inited = true
    w.claim[goal] = bot.id
    w.positions[bot.id] = f.pos
    w.agents[bot.id] = {
      pos: f.pos,
      node: start,
      dest: goal,
      moving: f.mode === 'travel',
      anchored: false,
      status: bot.status,
      selected: false,
      entering: f.entering,
      visit: null,
      talkWith: null,
      talkUntil: 0,
      holdUntil: 0,
      lastTalk: -99,
    }
    if (rootG.current) rootG.current.position.set(sx, 0, sz)
    return () => {
      delete w.positions[bot.id]
      delete w.agents[bot.id]
      for (const k of Object.keys(w.claim)) if (w.claim[k] === bot.id) delete w.claim[k]
      for (const k of Object.keys(w.using)) if (w.using[k].id === bot.id) delete w.using[k]
      sceneBus.setKeys(bot.id, false)
    }
    // Placement happens once per bot; later status changes re-plan in useFrame.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bot.id])

  useFrame(({ clock, camera }, rawDelta) => {
    const f = fsm.current
    const w = world
    const me = w.agents[bot.id]
    if (!f.inited || !me) return
    const dt = Math.min(rawDelta, 0.1)
    const t = clock.elapsedTime
    const status = bot.status
    const active = status === 'working' || status === 'thinking' || status === 'waiting'
    const waiting = status === 'waiting'

    if (f.fresh) {
      f.fresh = false
      const d = dwellFor(f.current, status)
      f.dwellUntil = Number.isFinite(d) ? t + Math.random() * d : Infinity
    }

    // --- reactions: selection + status changes ------------------------------
    if (selected && !f.wasSelected) f.waveUntil = t + 1.9
    if (selected && f.entering) f.waveUntil = t + 1.9 // wave once it's in
    f.wasSelected = selected
    if (status !== f.lastStatus) {
      if (status === 'done') {
        f.celebrateUntil = t + 1.9
        f.burstAt = t
      }
      if (f.mode === 'travel' && !f.stopShort && !f.entering && !suits(me.dest, status)) {
        // Heading somewhere that no longer fits — stop at the next waypoint.
        if (w.claim[me.dest] === bot.id) delete w.claim[me.dest]
        f.path = f.path.slice(0, f.pi + 1)
        me.dest = f.path[f.pi]
      }
      if (f.mode === 'dwell') {
        if (status === 'working' && suits(f.current, 'working')) f.dwellUntil = Infinity
        else if (!suits(f.current, status) || f.dwellUntil === Infinity)
          f.dwellUntil = Math.min(f.dwellUntil, t + 0.4 + Math.random() * 1.1)
        if (status === 'done') f.dwellUntil = Math.max(f.dwellUntil, f.celebrateUntil)
      }
      f.lastStatus = status
    }

    // Conversation bookkeeping.
    if (me.talkWith && me.talkUntil <= t) {
      me.talkWith = null
      me.lastTalk = t
    }
    const partner = me.talkWith ? w.agents[me.talkWith] : undefined

    let moving = false
    let faceYaw: number | null = null

    const depart = (path: string[], goal: string, stopShort = 0) => {
      if (w.claim[f.current] === bot.id) delete w.claim[f.current]
      if (goal && stopShort === 0) w.claim[goal] = bot.id
      // Step back onto the graph first if we drifted off our node.
      const [cx, cz] = node(f.current).pos
      if (Math.hypot(f.pos.x - cx, f.pos.z - cz) > 0.3) path = [f.current, ...path]
      if (node(f.current).kind === 'vend') f.carryUntil = t + 22 + Math.random() * 14
      f.path = path
      f.pi = 0
      f.stopShort = stopShort
      f.mode = 'travel'
      me.dest = goal
    }

    // A bot walking in keeps walking even if you select it (the Add repo dialog
    // does) — otherwise it would freeze behind the wall.
    const halted = selected && !f.entering
    if (halted) {
      // Come to attention: stop where you are, look at the camera.
    } else if (reducedMotion) {
      // Bots hold their spot; no wandering.
    } else if (f.mode === 'dwell') {
      if (f.waitFor) {
        // Arrived next to the bot we came to see — start talking once it's
        // standing still close by (it may still be walking to its spot).
        const host = w.agents[f.waitFor]
        if (!host || t > f.waitUntil) {
          f.waitFor = ''
        } else if (!host.moving && host.pos.distanceTo(f.pos) < ROAM.TALK_GAP + 1.0) {
          startTalk(w, bot.id, f.waitFor, t, ROAM.TALK_SECS)
          f.dwellUntil = t + ROAM.TALK_SECS + 0.5
          f.waitFor = ''
        }
      }
      if (me.visit) {
        // Walk over to where the bot we're talking to is (or is headed).
        const host = w.agents[me.visit]
        if (host) {
          const path = pathTo(f.current, host.dest)
          if (path.length) {
            depart(path, host.dest, ROAM.TALK_GAP)
            f.visitHost = me.visit
          } else {
            f.waitFor = me.visit
            f.waitUntil = t + 5
            f.dwellUntil = Math.max(f.dwellUntil, f.waitUntil)
          }
        }
        me.visit = null
      } else if (t > f.dwellUntil && me.holdUntil < t && !partner && !f.waitFor) {
        const carrying = t < f.carryUntil
        const goal = chooseGoal(f.current, w.claim, bot.id, status, {
          avoid: carrying ? 'vend' : undefined,
        })
        if (goal === f.current) {
          f.dwellUntil = t + dwellFor(goal, status)
        } else if (goal) {
          const path = pathTo(f.current, goal)
          if (path.length) depart(path, goal)
          else f.dwellUntil = t + 1 + Math.random() * 2
        } else {
          f.dwellUntil = t + 1 + Math.random() * 2
        }
      }
    }

    if (f.mode === 'travel' && me.visit && !f.stopShort && !f.entering && f.path.length > f.pi + 1) {
      // Asked to go talk to someone mid-walk: divert at the next waypoint.
      if (w.claim[me.dest] === bot.id) delete w.claim[me.dest]
      f.path = f.path.slice(0, f.pi + 1)
      me.dest = f.path[f.pi]
    }
    if (f.mode === 'travel' && !halted && !reducedMotion) {
      const target = node(f.path[f.pi]).pos
      const dx = target[0] - f.pos.x
      const dz = target[1] - f.pos.z
      const dist = Math.hypot(dx, dz)
      const last = f.pi === f.path.length - 1
      const arrive = last && f.stopShort ? f.stopShort : ROAM.ARRIVE
      if (dist < arrive) {
        if (last && f.stopShort) {
          // Stopped beside the bot we came to talk to (we're on a clear edge).
          f.stopShort = 0
          f.mode = 'dwell'
          me.dest = f.current
          f.waitFor = f.visitHost
          f.waitUntil = t + 5
          f.dwellUntil = f.waitUntil
          f.visitHost = ''
        } else {
          f.current = f.path[f.pi]
          f.pi += 1
          if (f.pi >= f.path.length) {
            f.mode = 'dwell'
            f.entering = false
            me.dest = f.current
            f.dwellUntil = suits(f.current, status)
              ? t + dwellFor(f.current, status)
              : t + 0.3 + Math.random() // status changed en route — re-plan soon
          }
        }
      } else {
        // Visits are purposeful: even a pensive bot walks over at a normal pace.
        const base = f.stopShort ? Math.max(ROAM.WALK[status], 1.4) : ROAM.WALK[status]
        const speed = base * (f.entering ? 1.1 : 1)
        const step = Math.min(speed * dt, dist)
        f.pos.x += (dx / dist) * step
        f.pos.z += (dz / dist) * step
        faceYaw = Math.atan2(dx, dz)
        moving = true
      }
      // Hold the door for a bot walking in.
      if (f.entering) {
        const [ox, oz] = node('door').pos
        if (Math.hypot(f.pos.x - ox, f.pos.z - oz) < 2.6) w.doorOpenUntil = t + 1.2
      }
    }

    const dn = node(f.current)
    const dwelling = f.mode === 'dwell'
    const sitting = !selected && dwelling && dn.sit != null && !moving

    // Soft separation so bodies don't interpenetrate. Seated / talking bots
    // stay put; walkers step around them. The selected bot never yields, so
    // everyone else steps aside for it.
    const anchored = dwelling && (sitting || !!partner)
    if (!selected && !anchored) {
      for (const [oid, op] of Object.entries(w.positions)) {
        if (oid === bot.id) continue
        const other = w.agents[oid]
        const dx = f.pos.x - op.x
        const dz = f.pos.z - op.z
        const d = Math.hypot(dx, dz)
        if (d > 0.001 && d < ROAM.BODY_SEP && (bot.id > oid || other?.anchored || other?.selected)) {
          const push = (ROAM.BODY_SEP - d) * 0.5
          f.pos.x += (dx / d) * push
          f.pos.z += (dz / d) * push
        }
      }
    }

    // Publish to the shared world.
    me.node = f.current
    me.moving = moving
    me.anchored = anchored
    me.status = status
    me.selected = selected
    me.entering = f.entering

    // --- facing --------------------------------------------------------------
    if ((selected || waiting) && !moving) {
      // Selected, or waiting for your OK: look at you.
      faceYaw = Math.atan2(camera.position.x - f.pos.x, camera.position.z - f.pos.z)
    } else if (!moving && (partner || f.waitFor)) {
      const o = partner ?? w.agents[f.waitFor]
      if (o) faceYaw = Math.atan2(o.pos.x - f.pos.x, o.pos.z - f.pos.z)
    } else if (!moving) {
      faceYaw = dn.face ?? Math.atan2(camera.position.x - f.pos.x, camera.position.z - f.pos.z)
      if (dn.face == null && status === 'thinking' && !reducedMotion) {
        faceYaw += Math.sin(t * 0.5 + phase) * 0.6 // looks around, lost in thought
      }
    }

    // --- pose ---------------------------------------------------------------
    let pose: Pose = 'stand'
    if (t < f.celebrateUntil && !reducedMotion) pose = 'cheer'
    else if (moving) pose = 'walk'
    else if (waiting) pose = 'raise' // hand up: needs your Allow / Deny
    else if (selected) pose = t < f.waveUntil && !reducedMotion ? 'wave' : 'stand'
    else if (partner) {
      const myTurn = Math.floor(t / 1.7) % 2 === (bot.id < (me.talkWith ?? '') ? 0 : 1)
      pose = myTurn ? 'talk' : 'listen'
    } else if (dwelling) {
      switch (dn.kind) {
        case 'desk':
          pose = status === 'working' ? 'type' : 'sit'
          break
        case 'lounge':
          pose = dn.sit != null ? (status === 'working' ? 'laptop' : 'sit') : 'stand'
          break
        case 'arcade':
          pose = 'play'
          break
        case 'pool':
          pose = 'pool'
          break
        case 'shelf':
          pose = 'read'
          break
        case 'board':
          pose = 'board'
          break
        case 'vend':
          pose = 'buy'
          break
        default:
          pose = status === 'thinking' ? 'think' : 'stand'
      }
    }
    if (reducedMotion && (pose === 'walk' || pose === 'wave')) pose = 'stand'

    const carrying = t < f.carryUntil && (pose === 'stand' || pose === 'walk' || pose === 'sit' || pose === 'listen')
    const target: Base = { aLx: 0, aLz: 0, aRx: 0, aRz: 0, hx: 0, hz: 0, lean: 0, ...POSE_BASE[pose] }
    if (carrying) {
      const sip = (t + phase * 3) % 7 < 1.3
      target.aRx = sip ? -2.25 : -0.75
      target.aRz = sip ? -0.25 : 0
      if (sip) target.hx = -0.18
    }
    const b = f.base
    const k = reducedMotion ? 1 : 1 - Math.exp(-dt * 9)
    for (const key of KEYS) b[key] += (target[key] - b[key]) * k

    // Per-pose motion layered on the smoothed base.
    let oLx = 0
    let oRx = 0
    let oLz = 0
    let oRz = 0
    let oHx = 0
    let oHz = 0
    let hop = 0
    if (!reducedMotion) {
      const s = (freq: number, o = 0) => Math.sin(t * freq + phase + o)
      switch (pose) {
        case 'walk':
          oLx = s(8) * 0.5
          oRx = carrying ? 0 : -s(8) * 0.5
          break
        case 'type':
          oLx = s(17) * 0.13
          oRx = s(17, Math.PI) * 0.13
          oHx = s(2.1) * 0.03
          break
        case 'laptop':
          oLx = s(15) * 0.09
          oRx = s(15, Math.PI) * 0.09
          break
        case 'think':
          oHz = s(0.9) * 0.07
          oRz = s(1.7) * 0.05
          break
        case 'play':
          oLx = s(9) * 0.35
          oRx = -s(9) * 0.35
          break
        case 'pool':
          oRx = s(2.4) * 0.22
          break
        case 'read':
          oHx = s(0.6) * 0.04
          break
        case 'board':
          oRx = s(7) * 0.12
          oRz = s(5.3) * 0.1
          break
        case 'buy':
          oRx = Math.max(0, s(5)) * 0.15
          break
        case 'talk':
          oLx = s(4.1) * 0.3
          oRx = s(3.3, 1) * 0.35
          oHx = s(6) * 0.06
          break
        case 'listen':
          oHx = s(2.6) * 0.09
          break
        case 'wave':
          oRz = Math.sin(t * 13) * 0.35
          break
        case 'raise':
          oRz = Math.sin(t * 6) * 0.12
          hop = Math.max(0, Math.sin(t * 3)) * 0.05
          break
        case 'cheer':
          oLz = Math.sin(t * 10) * 0.2
          oRz = -Math.sin(t * 10) * 0.2
          hop = Math.abs(Math.sin(t * 9)) * 0.26
          break
      }
    }

    // --- apply transforms ---------------------------------------------------
    if (rootG.current) rootG.current.position.set(f.pos.x, 0, f.pos.z)
    const seatLift = sitting ? dn.sit! : 0

    if (bodyG.current) {
      const g = bodyG.current
      const bobSpeed = moving ? 8 : active ? 3.1 : 2
      const bobAmt = moving ? 0.05 : sitting ? 0.02 : active ? 0.07 : 0.045
      g.position.y = (reducedMotion ? 0 : Math.sin(t * bobSpeed + phase) * bobAmt) + hop
      g.rotation.z = reducedMotion ? 0 : Math.sin(t * 1.4 + phase) * 0.05
      g.rotation.x = b.lean
      if (faceYaw != null) {
        if (reducedMotion) g.rotation.y = faceYaw
        else g.rotation.y += shortAngle(faceYaw - g.rotation.y) * (moving ? 0.18 : 0.09)
      }
    }
    if (headG.current) {
      headG.current.rotation.x = b.hx + oHx
      headG.current.rotation.z = b.hz + oHz
    }
    if (armL.current) {
      armL.current.rotation.x = b.aLx + oLx
      armL.current.rotation.z = b.aLz + oLz
    }
    if (armR.current) {
      armR.current.rotation.x = b.aRx + oRx
      armR.current.rotation.z = b.aRz + oRz
    }

    // Props.
    if (laptop.current) laptop.current.visible = pose === 'laptop'
    if (book.current) book.current.visible = pose === 'read'
    if (can.current) can.current.visible = carrying
    if (cue.current) {
      cue.current.visible = pose === 'pool'
      cue.current.position.z = 0.55 + oRx * 0.35
    }

    // Shared world: which furniture is in use (desk monitors/lamps light up in
    // this bot's color, arcade screens show a player).
    const usingNow =
      dwelling && !moving && !selected && (pose === 'type' || pose === 'play' || pose === 'pool')
        ? f.current
        : ''
    if (usingNow !== f.usingNode) {
      if (f.usingNode && w.using[f.usingNode]?.id === bot.id) delete w.using[f.usingNode]
      if (usingNow) w.using[usingNow] = { id: bot.id, accent: bot.accent }
      f.usingNode = usingNow
    }
    const typing = pose === 'type' || pose === 'laptop'
    if (typing !== f.keys) {
      f.keys = typing
      sceneBus.setKeys(bot.id, typing)
    }

    if (!reducedMotion && eyeL.current && eyeR.current) {
      const blink = (t * 0.42 + phase) % 1 > 0.94 ? 0.14 : 1
      const happy = pose === 'cheer' || pose === 'wave' ? 0.55 : 1
      eyeL.current.scale.y = blink * happy
      eyeR.current.scale.y = blink * happy
    }
    if (tip.current) {
      const m = tip.current.material as THREE.MeshStandardMaterial
      m.emissiveIntensity = active && !reducedMotion ? 1.1 + Math.sin(t * 3.4 + phase) * 0.6 : 0.9
    }
    if (ring.current) {
      const mat = ring.current.material as THREE.MeshBasicMaterial
      if (waiting) {
        // Pulsing amber ring: this bot is waiting on you.
        mat.color.copy(ATTENTION)
        mat.opacity = reducedMotion ? 0.75 : 0.5 + Math.sin(t * 5) * 0.3
        ring.current.scale.setScalar(reducedMotion ? 1.2 : 1.15 + Math.sin(t * 5) * 0.08)
      } else {
        mat.color.set(bot.accent)
        mat.opacity = selected ? 0.6 : active ? 0.34 : 0.22
        ring.current.scale.setScalar(selected ? 1.14 : 1)
      }
    }
    if (scaleG.current) {
      const s = hovered || selected ? 1.09 : 1
      scaleG.current.scale.setScalar(THREE.MathUtils.lerp(scaleG.current.scale.x, s, 0.15))
      scaleG.current.position.y = THREE.MathUtils.lerp(scaleG.current.position.y, seatLift, 0.12)
    }

    // Confetti burst on "done".
    const se = t - f.burstAt
    if (sparks.current) {
      const on = se < SPARK_LIFE && !reducedMotion
      sparks.current.visible = on
      if (on) {
        sparks.current.children.forEach((c, i) => {
          const d = SPARK_DIRS[i]
          c.position.set(d.x * se, 1.45 + d.y * se - 2.6 * se * se, d.z * se)
          c.rotation.set(se * 7 + i, se * 5, 0)
          c.scale.setScalar(1 - se / SPARK_LIFE)
        })
        sparkMat.opacity = 1 - se / SPARK_LIFE
      }
    }

    // Hide the name tag while walking in behind the wall.
    const hide = f.pos.z < -9.05
    if (hide !== f.tagHidden && tag.current) {
      f.tagHidden = hide
      tag.current.style.opacity = hide ? '0' : ''
    }
  })

  const onDown = (e: ThreeEvent<PointerEvent>) => {
    down.current = { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY }
  }
  const onUp = (e: ThreeEvent<PointerEvent>) => {
    const d = down.current
    down.current = null
    if (!d) return
    if (Math.hypot(e.nativeEvent.clientX - d.x, e.nativeEvent.clientY - d.y) < 6) {
      e.stopPropagation()
      onSelect(bot.id)
    }
  }
  const enter = () => {
    setHovered(true)
    document.body.style.cursor = 'pointer'
  }
  const leave = () => {
    setHovered(false)
    document.body.style.cursor = ''
  }

  return (
    <group ref={rootG}>
      <mesh ref={ring} rotation-x={-Math.PI / 2} position={[0, 0.08, 0]} renderOrder={2}>
        <ringGeometry args={[0.44, 0.6, 44]} />
        <meshBasicMaterial
          color={bot.accent}
          transparent
          opacity={0.28}
          toneMapped={false}
          depthWrite={false}
        />
      </mesh>

      <group ref={scaleG} onPointerDown={onDown} onPointerUp={onUp} onPointerOver={enter} onPointerOut={leave}>
        <group ref={bodyG}>
          <RoundedBox args={[0.66, 0.66, 0.46]} radius={0.18} smoothness={3} position={[0, 0.62, 0]}>
            <meshStandardMaterial color={bot.accent} roughness={0.6} />
          </RoundedBox>
          <mesh position={[0, 0.64, 0.235]}>
            <boxGeometry args={[0.2, 0.2, 0.02]} />
            <meshStandardMaterial color={bright} emissive={bot.accent} emissiveIntensity={0.9} toneMapped={false} />
          </mesh>
          {/* arms (pivot at shoulder) */}
          <group ref={armL} position={[-0.44, 0.74, 0]}>
            <RoundedBox args={[0.15, 0.32, 0.15]} radius={0.07} smoothness={2} position={[0, -0.16, 0]}>
              <meshStandardMaterial color={armColor} roughness={0.6} />
            </RoundedBox>
          </group>
          <group ref={armR} position={[0.44, 0.74, 0]}>
            <RoundedBox args={[0.15, 0.32, 0.15]} radius={0.07} smoothness={2} position={[0, -0.16, 0]}>
              <meshStandardMaterial color={armColor} roughness={0.6} />
            </RoundedBox>
            {/* soda can from the vending machine */}
            <mesh ref={can} position={[0, -0.36, 0.04]} visible={false}>
              <cylinderGeometry args={[0.055, 0.055, 0.15, 12]} />
              <meshStandardMaterial color="#ff5f6d" roughness={0.35} />
            </mesh>
          </group>
          <group ref={headG} position={[0, 1.12, 0]}>
            <RoundedBox args={[0.6, 0.5, 0.46]} radius={0.18} smoothness={3}>
              <meshStandardMaterial color={headColor} roughness={0.55} />
            </RoundedBox>
            <RoundedBox args={[0.44, 0.3, 0.06]} radius={0.09} smoothness={2} position={[0, 0.02, 0.22]}>
              <meshStandardMaterial color="#171226" roughness={0.4} />
            </RoundedBox>
            <mesh ref={eyeL} position={[-0.1, 0.03, 0.26]}>
              <sphereGeometry args={[0.055, 16, 16]} />
              <meshStandardMaterial color={EYE} emissive={EYE} emissiveIntensity={1.1} toneMapped={false} />
            </mesh>
            <mesh ref={eyeR} position={[0.1, 0.03, 0.26]}>
              <sphereGeometry args={[0.055, 16, 16]} />
              <meshStandardMaterial color={EYE} emissive={EYE} emissiveIntensity={1.1} toneMapped={false} />
            </mesh>
            <mesh position={[0, 0.33, 0]}>
              <cylinderGeometry args={[0.02, 0.02, 0.22, 8]} />
              <meshStandardMaterial color={armColor} roughness={0.6} />
            </mesh>
            <mesh ref={tip} position={[0, 0.47, 0]}>
              <sphereGeometry args={[0.06, 16, 16]} />
              <meshStandardMaterial color={bright} emissive={bot.accent} emissiveIntensity={0.9} toneMapped={false} />
            </mesh>
          </group>

          {/* laptop on the lap (working from the sofa) */}
          <group ref={laptop} position={[0, 0.52, 0.42]} visible={false}>
            <mesh>
              <boxGeometry args={[0.42, 0.025, 0.28]} />
              <meshStandardMaterial color="#2b2540" roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.13, -0.15]} rotation-x={-0.3}>
              <boxGeometry args={[0.42, 0.27, 0.02]} />
              <meshStandardMaterial color="#2b2540" roughness={0.5} />
            </mesh>
            <mesh position={[0, 0.13, -0.135]} rotation-x={-0.3}>
              <planeGeometry args={[0.36, 0.21]} />
              <meshBasicMaterial color={bright} toneMapped={false} side={THREE.DoubleSide} />
            </mesh>
          </group>
          {/* a book (browsing the shelf) */}
          <mesh ref={book} position={[0, 0.86, 0.36]} rotation-x={-0.5} visible={false}>
            <boxGeometry args={[0.3, 0.22, 0.05]} />
            <meshStandardMaterial color={mixHex(bot.accent, '#000000', 0.3)} roughness={0.7} />
          </mesh>
          {/* pool cue */}
          <mesh ref={cue} position={[0.08, 0.8, 0.55]} rotation-x={Math.PI / 2 + 0.2} visible={false}>
            <cylinderGeometry args={[0.018, 0.028, 1.5, 8]} />
            <meshStandardMaterial color="#d6b48a" roughness={0.6} />
          </mesh>
        </group>
      </group>

      <group ref={sparks} visible={false}>
        {SPARK_DIRS.map((_, i) => (
          <mesh key={i} geometry={SPARK_GEO} material={sparkMat} />
        ))}
      </group>

      <Html position={[0, LABEL_Y, 0]} center zIndexRange={[30, 0]}>
        <div className="bot-tag" ref={tag}>
          <SpeechBubble botId={bot.id} />
          <button
            type="button"
            className="bot-badge"
            data-selected={selected || undefined}
            style={{ '--a': bot.accent } as React.CSSProperties}
            onClick={() => onSelect(bot.id)}
          >
            {/* Only statuses worth a glance float over the bot (idle is the
                default, and the open panel already shows the status). */}
            {!selected && bot.status !== 'idle' && <StatusPill status={bot.status} floating />}
            <span className="bot-badge__name">
              <FolderGit2 className="bot-badge__role" size={12} strokeWidth={2.6} />
              {bot.name}
            </span>
          </button>
        </div>
      </Html>
    </group>
  )
})
