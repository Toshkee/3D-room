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

export const CREW: Bot[] = [
  {
    id: 'ada',
    name: 'Ada',
    role: 'engineer',
    accent: '#6d5efc',
    blurb: 'Ships fast, tests everything twice.',
    seat: 3,
    status: 'working',
    task: 'Refactoring the auth service',
    progress: 42,
  },
  {
    id: 'kepler',
    name: 'Kepler',
    role: 'researcher',
    accent: '#2aa7ff',
    blurb: "Reads the whole internet so you don't have to.",
    seat: 4,
    status: 'thinking',
    task: 'Surveying vector search options',
    progress: 61,
  },
  {
    id: 'iris',
    name: 'Iris',
    role: 'designer',
    accent: '#ff5fa2',
    blurb: 'Sweats every pixel and every gap.',
    seat: 9,
    status: 'working',
    task: 'Polishing the design system',
    progress: 78,
  },
  {
    id: 'quill',
    name: 'Quill',
    role: 'writer',
    accent: '#14b8a6',
    blurb: 'Turns rough ideas into clean prose.',
    seat: 6,
    status: 'idle',
    task: 'Drafting the launch post',
    progress: 15,
  },
  {
    id: 'vega',
    name: 'Vega',
    role: 'analyst',
    accent: '#f5a524',
    blurb: 'Finds the signal in the noise.',
    seat: 1,
    status: 'working',
    task: 'Analyzing the Q3 funnel',
    progress: 33,
  },
  {
    id: 'atlas',
    name: 'Atlas',
    role: 'coordinator',
    accent: '#22c55e',
    blurb: 'Keeps everyone rowing the same way.',
    seat: 11,
    status: 'thinking',
    task: 'Planning the next sprint',
    progress: 50,
  },
]

/** First seat index not already taken by a bot (wraps if the room is full). */
export function firstOpenSeat(bots: Bot[]): number {
  const taken = new Set(bots.map((b) => b.seat))
  for (let i = 0; i < SEATS.length; i++) if (!taken.has(i)) return i
  return bots.length % SEATS.length
}
