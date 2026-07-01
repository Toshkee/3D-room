/**
 * Ambient-life layout + helpers — drives the gamers' autonomous roaming (see
 * `scene/Person.tsx`). They wander a tiny waypoint graph: a convex, furniture-free
 * **front stage** where any straight line between points is clip-free, plus
 * occasional **desk excursions** to the back arena down two pre-cleared corridors.
 *
 * Coordinates are verified against the furniture: everything solid sits at
 * z ≤ -1.8 (sofa front) or out at the side/back walls, so the stage rectangle
 * x∈[-7,7], z∈[-0.4,6.6] is clear, and the x=±5 / z=-6.0 corridor bands are clear.
 */

export type Flavor = 'MILL' | 'CHAT' | 'WATCH' | 'DESK'

export type AmbientNode = {
  id: string
  pos: [number, number]
  /** Facing while dwelling here (CHAT overrides toward the live partner). */
  faceY: number
  flavor: Flavor
  /** For CHAT: the id of the facing partner slot. */
  partner?: string
}

// Front-stage dwell spots (convex zone, all reachable from each other in one hop).
export const STAGE_NODES: AmbientNode[] = [
  // mill about (loose, the walk-in homes)
  { id: 'M1', pos: [-5.0, 2.0], faceY: 0.36, flavor: 'MILL' },
  { id: 'M2', pos: [-2.5, 2.2], faceY: 0.16, flavor: 'MILL' },
  { id: 'M3', pos: [0.0, 2.0], faceY: 0.0, flavor: 'MILL' },
  { id: 'M4', pos: [2.5, 2.2], faceY: -0.16, flavor: 'MILL' },
  { id: 'M5', pos: [5.0, 2.0], faceY: -0.36, flavor: 'MILL' },
  { id: 'M6', pos: [-3.5, 5.2], faceY: 0.2, flavor: 'MILL' },
  { id: 'M7', pos: [0.0, 5.6], faceY: 0.0, flavor: 'MILL' },
  { id: 'M8', pos: [3.5, 5.2], faceY: -0.2, flavor: 'MILL' },
  // chat pairs (face the partner slot ~1.2m away)
  { id: 'C1a', pos: [-4.2, 3.6], faceY: 0, flavor: 'CHAT', partner: 'C1b' },
  { id: 'C1b', pos: [-3.0, 3.6], faceY: 0, flavor: 'CHAT', partner: 'C1a' },
  { id: 'C2a', pos: [3.0, 3.6], faceY: 0, flavor: 'CHAT', partner: 'C2b' },
  { id: 'C2b', pos: [4.2, 3.6], faceY: 0, flavor: 'CHAT', partner: 'C2a' },
  { id: 'C3a', pos: [-0.7, 4.4], faceY: 0, flavor: 'CHAT', partner: 'C3b' },
  { id: 'C3b', pos: [0.7, 4.4], faceY: 0, flavor: 'CHAT', partner: 'C3a' },
  // watch the wall screen (faceY = π, an arc in front of the sofa)
  { id: 'W1', pos: [-2.4, -0.35], faceY: Math.PI, flavor: 'WATCH' },
  { id: 'W2', pos: [-0.8, -0.4], faceY: Math.PI, flavor: 'WATCH' },
  { id: 'W3', pos: [0.8, -0.4], faceY: Math.PI, flavor: 'WATCH' },
  { id: 'W4', pos: [2.4, -0.35], faceY: Math.PI, flavor: 'WATCH' },
]

// Workstation approach spots at the back desks (face the back wall).
export const DESK_NODES: AmbientNode[] = [
  { id: 'D0', pos: [-6, -6.0], faceY: Math.PI, flavor: 'DESK' },
  { id: 'D1', pos: [-2, -6.0], faceY: Math.PI, flavor: 'DESK' },
  { id: 'D2', pos: [2, -6.0], faceY: Math.PI, flavor: 'DESK' },
  { id: 'D3', pos: [6, -6.0], faceY: Math.PI, flavor: 'DESK' },
]

const NODE_BY_ID: Record<string, AmbientNode> = {}
for (const n of [...STAGE_NODES, ...DESK_NODES]) NODE_BY_ID[n.id] = n
export const nodeById = (id: string): AmbientNode | undefined => NODE_BY_ID[id]

// Corridor transit points (not dwell spots): stage edge → back band.
const CL: [number, number] = [-5.0, 0.0]
const CLn: [number, number] = [-5.0, -6.0]
const CR: [number, number] = [5.0, 0.0]
const CRn: [number, number] = [5.0, -6.0]

export type Occupancy = {
  /** nodeId → owning agent id (reserved while targeted or occupied). */
  nodes: Record<string, string | undefined>
  /** corridor side → owning agent id (held for a whole desk excursion). */
  corridors: { L: string | null; R: string | null }
}

export const AMBIENT = {
  WALK_SPEED: 1.6,
  RUN_SPEED: 3.0,
  ARRIVE: 0.12,
  SEP_DIST: 0.75, // home node is "coincident" within this radius (claimed on arrival)
  BODY_SEP: 0.6, // hard min center-to-center distance between two gamers' bodies
  RUN_LEN: 9, // path longer than this → run
  RUN_DICE: 0.12, // else 12% chance to run a trip
  CLAMP_X: 9.2,
  CLAMP_Z: 7.6,
  dwell: { MILL: [3, 7], CHAT: [6, 12], WATCH: [8, 16], DESK: [5, 10] } as Record<Flavor, [number, number]>,
  weight: { MILL: 2, CHAT: 2, WATCH: 3, DESK: 0.8 } as Record<Flavor, number>,
} as const

/** Path (point list) from the stage to a target node. */
export function pathTo(node: AmbientNode): [number, number][] {
  if (node.flavor === 'DESK') {
    return node.pos[0] < 0 ? [CL, CLn, node.pos] : [CR, CRn, node.pos]
  }
  return [node.pos]
}

/** Return path from a desk back out to a stage node. */
export function pathFromDeskTo(desk: AmbientNode, target: AmbientNode): [number, number][] {
  const back: [number, number][] = desk.pos[0] < 0 ? [CLn, CL] : [CRn, CR]
  return [...back, target.pos]
}

export function pathLength(from: { x: number; z: number }, pts: [number, number][]): number {
  let len = 0
  let px = from.x
  let pz = from.z
  for (const [x, z] of pts) {
    len += Math.hypot(x - px, z - pz)
    px = x
    pz = z
  }
  return len
}

/**
 * Pick the next destination (weighted) over free, reachable nodes. Herds toward
 * the screen (×3 if anyone's already watching) and forms chat pairs (×4 if the
 * partner slot is taken). From a desk you can only return to the stage.
 */
export function chooseGoal(
  occ: Occupancy,
  currentNodeId: string | null,
  onDesk: boolean,
  myId: string,
): AmbientNode | null {
  const taken = (id: string) => occ.nodes[id] !== undefined && occ.nodes[id] !== myId
  const cands: { n: AmbientNode; w: number }[] = []

  for (const n of STAGE_NODES) {
    if (n.id === currentNodeId || taken(n.id)) continue
    let w = AMBIENT.weight[n.flavor]
    if (n.flavor === 'WATCH') {
      if (STAGE_NODES.some((s) => s.flavor === 'WATCH' && occ.nodes[s.id])) w *= 3
    } else if (n.flavor === 'CHAT') {
      if (n.partner && occ.nodes[n.partner]) w *= 4
    }
    cands.push({ n, w })
  }
  if (!onDesk) {
    for (const d of DESK_NODES) {
      if (taken(d.id)) continue
      const side = d.pos[0] < 0 ? 'L' : 'R'
      if (occ.corridors[side] && occ.corridors[side] !== myId) continue
      cands.push({ n: d, w: AMBIENT.weight.DESK })
    }
  }

  if (cands.length === 0) return null
  const total = cands.reduce((s, c) => s + c.w, 0)
  let r = Math.random() * total
  for (const c of cands) {
    r -= c.w
    if (r <= 0) return c.n
  }
  return cands[cands.length - 1].n
}
