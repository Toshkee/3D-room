// ---------------------------------------------------------------------------
// Autonomous roaming graph. Bots wander between these nodes; each edge is a
// straight segment through CLEAR floor (hand-placed to avoid the furniture
// clusters — arcades along the back, desks along the left wall, the sitting
// area front-right). Activity nodes (arcade/desk/lounge) sit just in front of
// their furniture so a bot "visits" it without walking inside it.
// ---------------------------------------------------------------------------

export type NodeKind = 'arcade' | 'desk' | 'lounge' | 'mingle'

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
  { id: 'a0', pos: [-6.0, -6.3], kind: 'arcade', face: PI },
  { id: 'a1', pos: [-3.4, -6.3], kind: 'arcade', face: PI },
  { id: 'a2', pos: [-0.8, -6.3], kind: 'arcade', face: PI },
  { id: 'd0', pos: [-8.0, -3.2], kind: 'desk', face: -PI / 2 },
  { id: 'd1', pos: [-8.0, 0.0], kind: 'desk', face: -PI / 2 },
  { id: 'd2', pos: [-8.0, 3.2], kind: 'desk', face: -PI / 2 },
  { id: 'l0', pos: [2.8, 1.9], kind: 'lounge', face: PI },
  { id: 'l1', pos: [5.0, 1.9], kind: 'lounge', face: PI },
  // Seats — bots actually sit ON the furniture (sofa / armchair / beanbag),
  // facing out toward the wall screen. `sit` lifts the body onto the cushion.
  { id: 's0', pos: [2.95, 3.05], kind: 'lounge', face: PI, sit: 0.4 },
  { id: 's1', pos: [4.0, 3.0], kind: 'lounge', face: PI, sit: 0.4 },
  { id: 's2', pos: [5.05, 3.05], kind: 'lounge', face: PI, sit: 0.4 },
  { id: 's3', pos: [7.6, 3.4], kind: 'lounge', face: -2.2, sit: 0.4 },
  { id: 's4', pos: [1.3, 4.7], kind: 'lounge', face: 2.5, sit: 0.26 },
  { id: 'm0', pos: [-2.0, -0.6], kind: 'mingle' },
  { id: 'm1', pos: [-5.0, -1.5], kind: 'mingle' },
  { id: 'm2', pos: [-0.5, -3.6], kind: 'mingle' },
  { id: 'm3', pos: [-4.5, 2.6], kind: 'mingle' },
  { id: 'm4', pos: [-1.5, 3.6], kind: 'mingle' },
  { id: 'm5', pos: [1.0, -1.0], kind: 'mingle' },
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
  ['l0', 'l1'],
  // seats hang off the lounge hub (segments stay clear of the coffee table)
  ['s0', 'l0'],
  ['s1', 'l0'],
  ['s1', 'l1'],
  ['s2', 'l1'],
  ['s0', 's1'],
  ['s1', 's2'],
  ['s3', 'l1'],
  ['s4', 'l0'],
  ['s4', 'm4'],
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

export interface Occupancy {
  /** nodeId → botId currently there or heading there. */
  claim: Record<string, string>
}

// Breadth-first shortest path (node ids) from → to, inclusive of `to`.
export function pathTo(from: string, to: string): string[] {
  if (from === to) return []
  const prev: Record<string, string> = {}
  const seen = new Set([from])
  const q = [from]
  while (q.length) {
    const cur = q.shift()!
    for (const nx of ADJ[cur]) {
      if (seen.has(nx)) continue
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

// Pick a new destination for a bot at `current`. Prefers a different flavor of
// spot (so bots don't ping-pong), skips nodes already claimed by others.
export function chooseGoal(current: string, occ: Occupancy, selfId: string): string | null {
  const curKind = node(current).kind
  const free = NODES.filter(
    (n) => n.id !== current && (!occ.claim[n.id] || occ.claim[n.id] === selfId),
  )
  if (!free.length) return null
  // Weight: activities are attractive; avoid repeating the same kind.
  const weighted: RNode[] = []
  for (const n of free) {
    let w = n.kind === 'mingle' ? 2 : 3
    if (n.kind === curKind) w = 1
    for (let i = 0; i < w; i++) weighted.push(n)
  }
  return weighted[Math.floor(Math.random() * weighted.length)].id
}

// Nearest node to a world position — used to seat a bot on the graph initially.
export function nearestNode(x: number, z: number): string {
  let best = NODES[0]
  let bd = Infinity
  for (const n of NODES) {
    const d = (n.pos[0] - x) ** 2 + (n.pos[1] - z) ** 2
    if (d < bd) {
      bd = d
      best = n
    }
  }
  return best.id
}

export const ROAM = {
  WALK: 1.5, // units / sec
  DWELL_MIN: 2.5,
  DWELL_MAX: 6.5,
  ARRIVE: 0.12, // distance to consider a waypoint reached
  BODY_SEP: 0.9, // min distance between bots (soft)
}
