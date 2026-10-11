import type { Status } from '../types'

// ---------------------------------------------------------------------------
// Autonomous roaming graph. Bots walk between these nodes; each edge is a
// straight segment through CLEAR floor (hand-placed to avoid the furniture —
// arcades + vending machine along the back wall, bookshelf / desks /
// whiteboard along the left wall, the sofa corner front-right, the pool table
// on the right). Activity nodes sit just in front of (or on) their furniture
// so a bot "uses" it without walking inside it.
//
// Where a bot goes depends on its STATUS, so the room reads at a glance:
//   working  → a desk (sits, types; its monitor + lamp take its color), or a
//              laptop on the sofa when every desk is taken
//   thinking → paces the floor, browses the bookshelf, stands at the whiteboard
//   idle     → arcades, sofa/armchair/beanbag, pool table, vending machine
//   done     → celebrates where it stands, then wanders
// ---------------------------------------------------------------------------

export type NodeKind =
  | 'arcade'
  | 'desk'
  | 'lounge'
  | 'mingle'
  | 'pool'
  | 'vend'
  | 'shelf'
  | 'board'
  | 'door'

export interface RNode {
  id: string
  pos: [number, number]
  kind: NodeKind
  /** Yaw the bot faces while dwelling here (undefined → face the camera). */
  face?: number
  /** If set, the bot sits here — its body rises by this many units onto a seat. */
  sit?: number
}

const PI = Math.PI

export const NODES: RNode[] = [
  // arcade cabinets (back wall)
  { id: 'a0', pos: [-6.0, -6.3], kind: 'arcade', face: PI },
  { id: 'a1', pos: [-3.4, -6.3], kind: 'arcade', face: PI },
  { id: 'a2', pos: [-0.8, -6.3], kind: 'arcade', face: PI },
  // workstation desks (left wall) — the bot sits on the desk chair
  { id: 'd0', pos: [-9.35, -3.2], kind: 'desk', face: -PI / 2, sit: 0.3 },
  { id: 'd1', pos: [-9.35, 0.0], kind: 'desk', face: -PI / 2, sit: 0.3 },
  { id: 'd2', pos: [-9.35, 3.2], kind: 'desk', face: -PI / 2, sit: 0.3 },
  // standing spots at either end of the coffee table
  { id: 'l0', pos: [2.05, 1.35], kind: 'lounge', face: PI / 2 },
  { id: 'l1', pos: [5.95, 1.3], kind: 'lounge', face: -PI / 2 },
  // seats — bots sit ON the sofa / armchair / beanbag, facing the wall screen
  { id: 's0', pos: [2.95, 3.05], kind: 'lounge', face: PI, sit: 0.4 },
  { id: 's1', pos: [4.0, 3.0], kind: 'lounge', face: PI, sit: 0.4 },
  { id: 's2', pos: [5.05, 3.05], kind: 'lounge', face: PI, sit: 0.4 },
  { id: 's3', pos: [7.6, 3.4], kind: 'lounge', face: -2.2, sit: 0.4 },
  { id: 's4', pos: [1.3, 4.7], kind: 'lounge', face: 2.5, sit: 0.26 },
  // open floor
  { id: 'm0', pos: [-2.0, -0.6], kind: 'mingle' },
  { id: 'm1', pos: [-5.0, -1.5], kind: 'mingle' },
  { id: 'm2', pos: [-0.5, -3.6], kind: 'mingle' },
  { id: 'm3', pos: [-4.5, 2.6], kind: 'mingle' },
  { id: 'm4', pos: [-1.5, 3.6], kind: 'mingle' },
  { id: 'm5', pos: [1.0, -1.0], kind: 'mingle' },
  { id: 'm6', pos: [5.0, -4.9], kind: 'mingle' },
  { id: 'm7', pos: [10.0, -4.3], kind: 'mingle' },
  { id: 'm8', pos: [10.0, 0.9], kind: 'mingle' },
  // props
  { id: 'p0', pos: [5.55, -1.6], kind: 'pool', face: PI / 2 },
  { id: 'vend', pos: [7.6, -6.25], kind: 'vend', face: PI },
  { id: 'b0', pos: [-9.55, -7.1], kind: 'shelf', face: -PI / 2 },
  { id: 'wb', pos: [-6.76, 5.6], kind: 'board', face: -1.12 },
  // the door (back wall, right) and the corridor behind it — entry only
  { id: 'door', pos: [9.6, -6.95], kind: 'door' },
  { id: 'out', pos: [9.6, -10.4], kind: 'door' },
]

// Undirected adjacency — each pair's segment is clear of furniture.
const EDGES: [string, string][] = [
  ['a0', 'm1'],
  ['a1', 'm0'],
  ['a1', 'm2'],
  ['a2', 'm2'],
  ['a2', 'm5'],
  ['d0', 'm1'],
  ['d1', 'm1'],
  ['d2', 'm3'],
  ['m0', 'm1'],
  ['m0', 'm2'],
  ['m0', 'm3'],
  ['m0', 'm5'],
  ['m1', 'm3'],
  ['m2', 'm5'],
  ['m3', 'm4'],
  ['m4', 'm5'],
  ['m4', 'l0'],
  ['m5', 'l0'],
  // seats hang off the table-end spots (segments stay clear of the table)
  ['s0', 'l0'],
  ['s1', 'l0'],
  ['s1', 'l1'],
  ['s2', 'l1'],
  ['s0', 's1'],
  ['s1', 's2'],
  ['s3', 'l1'],
  ['s4', 'l0'],
  ['s4', 'm4'],
  // right side of the room: pool table, vending machine, the door
  ['l1', 'p0'],
  ['p0', 'm6'],
  ['p0', 'm5'],
  ['m6', 'm2'],
  ['m6', 'vend'],
  ['vend', 'door'],
  ['door', 'out'],
  ['door', 'm7'],
  ['m7', 'm6'],
  ['m7', 'm8'],
  ['m8', 'l1'],
  ['m8', 's3'],
  // bookshelf (left wall) + the rolling whiteboard (front-left corner)
  ['b0', 'a0'],
  ['b0', 'm1'],
  ['wb', 'm3'],
  ['wb', 'm4'],
]

export const ADJ: Record<string, string[]> = (() => {
  const a: Record<string, string[]> = {}
  for (const n of NODES) a[n.id] = []
  for (const [x, y] of EDGES) {
    a[x].push(y)
    a[y].push(x)
  }
  return a
})()

const BY_ID: Record<string, RNode> = Object.fromEntries(NODES.map((n) => [n.id, n]))

export const node = (id: string): RNode => BY_ID[id]

/** True for a seat (sofa / armchair / beanbag / desk chair). */
export const isSeat = (id: string) => node(id).sit != null

// Breadth-first shortest path (node ids) from → to, inclusive of `to`.
// `allow` restricts which nodes the path may pass through (the roomba avoids seats).
export function pathTo(from: string, to: string, allow?: (id: string) => boolean): string[] {
  if (from === to) return []
  const prev: Record<string, string> = {}
  const seen = new Set([from])
  const q = [from]
  while (q.length) {
    const cur = q.shift()!
    for (const nx of ADJ[cur]) {
      if (seen.has(nx) || (allow && nx !== to && !allow(nx))) continue
      seen.add(nx)
      prev[nx] = cur
      if (nx === to) {
        const path = [nx]
        let c = cur
        while (c !== from) {
          path.unshift(c)
          c = prev[c]
        }
        return path
      }
      q.push(nx)
    }
  }
  return []
}

// How attractive each kind of spot is, per status.
const PREFS: Record<Status, Partial<Record<NodeKind, number>>> = {
  working: { desk: 1 },
  thinking: { mingle: 3, shelf: 3, board: 4 },
  idle: { arcade: 3, lounge: 3, pool: 2, vend: 1.2, shelf: 1, mingle: 1 },
  done: { lounge: 2, mingle: 2, arcade: 1 },
}

/** Does dwelling at `id` fit what a bot with this status should be doing? */
export function suits(id: string, status: Status): boolean {
  const n = node(id)
  if (status === 'done') return true
  if (status === 'working') return n.kind === 'desk' || (n.kind === 'lounge' && n.sit != null)
  return (PREFS[status][n.kind] ?? 0) > 0
}

// Pick a destination for a bot at `current`, by status. Skips nodes claimed by
// other bots. Working bots take a free desk, else a free seat (laptop mode).
export function chooseGoal(
  current: string,
  claim: Record<string, string>,
  selfId: string,
  status: Status,
  opts: { avoid?: NodeKind } = {},
): string | null {
  const free = NODES.filter(
    (n) => n.kind !== 'door' && (!claim[n.id] || claim[n.id] === selfId),
  )
  if (status === 'working') {
    const desks = free.filter((n) => n.kind === 'desk')
    const pool = desks.length ? desks : free.filter((n) => n.kind === 'lounge' && n.sit != null)
    if (!pool.length) return null
    // Stay put if already at a suitable spot.
    if (pool.some((n) => n.id === current)) return current
    return pool[Math.floor(Math.random() * pool.length)].id
  }
  const prefs = PREFS[status]
  const curKind = node(current).kind
  const weighted: { id: string; w: number }[] = []
  for (const n of free) {
    if (n.id === current) continue
    let w = prefs[n.kind] ?? 0
    if (!w) continue
    if (status === 'idle' && n.kind === curKind) w *= 0.3 // don't ping-pong
    if (opts.avoid && n.kind === opts.avoid) w *= 0.1
    weighted.push({ id: n.id, w })
  }
  if (!weighted.length) return null
  let r = Math.random() * weighted.reduce((s, x) => s + x.w, 0)
  for (const x of weighted) {
    r -= x.w
    if (r <= 0) return x.id
  }
  return weighted[weighted.length - 1].id
}

/** How long to stay at a spot (seconds). Working bots stay until their status changes. */
export function dwellFor(id: string, status: Status): number {
  const n = node(id)
  const r = (a: number, b: number) => a + Math.random() * (b - a)
  if (status === 'working' && suits(id, 'working')) return Infinity
  if (status === 'thinking') {
    if (n.kind === 'board') return r(5, 9)
    if (n.kind === 'shelf') return r(4, 7)
    return r(1.4, 3.2)
  }
  if (status === 'done') return r(2, 4)
  switch (n.kind) {
    case 'arcade':
    case 'pool':
      return r(6, 12)
    case 'vend':
      return 2.4
    case 'shelf':
      return r(4, 7)
    case 'lounge':
      return n.sit != null ? r(6, 12) : r(3, 6)
    default:
      return r(2, 4)
  }
}

// Nearest node to a world position — used to seat a bot on the graph initially.
export function nearestNode(x: number, z: number): string {
  let best = NODES[0]
  let bd = Infinity
  for (const n of NODES) {
    if (n.kind === 'door') continue
    const d = (n.pos[0] - x) ** 2 + (n.pos[1] - z) ** 2
    if (d < bd) {
      bd = d
      best = n
    }
  }
  return best.id
}

export const ROAM = {
  /** Walk speed (units/sec) by status — thinking bots pace slowly. */
  WALK: { working: 1.75, thinking: 0.85, idle: 1.35, done: 1.5 } as Record<Status, number>,
  ARRIVE: 0.12, // distance to consider a waypoint reached
  BODY_SEP: 0.9, // min distance between bots (soft)
  /** How close a visitor stops to the bot it walked over to talk to. */
  TALK_GAP: 1.15,
  TALK_SECS: 7,
}
