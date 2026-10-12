import type { Bot } from '../types'

// Seats in the (now much bigger) lounge, in floor coords [x, z].
// Floor spans x:[-11,11], z:[-9,9]; camera looks in from +x/+z, back walls at
// z=-9 and x=-11. Seats map to zones built in Room.tsx: arcade cabinets along
// the back, workstation desks along the left wall, a sitting area (sofa/
// armchair/beanbag) front-right, and a couple standing spots in the middle.
export const SEATS: [number, number][] = [
  [-6.0, -6.6], //  0 arcade A
  [-3.4, -6.6], //  1 arcade B
  [-0.8, -6.6], //  2 arcade C
  [-8.4, -3.2], //  3 desk A (left wall)
  [-8.4, 0.0], //   4 desk B
  [-8.4, 3.2], //   5 desk C
  [2.2, 2.1], //    6 sofa left
  [4.0, 1.8], //    7 sofa mid
  [5.8, 2.1], //    8 sofa right
  [7.8, 3.7], //    9 armchair
  [1.3, 4.9], //   10 beanbag
  [-1.6, 0.6], //  11 center-left (standing)
  [1.4, -1.4], //  12 center-right (standing)
]

// Height the floating name/status label sits at, above a bot's head.
export const LABEL_Y = 2.0

/** First seat index not already taken by a bot (wraps if the room is full). */
export function firstOpenSeat(bots: Bot[]): number {
  const taken = new Set(bots.map((b) => b.seat))
  for (let i = 0; i < SEATS.length; i++) if (!taken.has(i)) return i
  return bots.length % SEATS.length
}
