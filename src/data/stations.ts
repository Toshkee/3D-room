/**
 * Where things go in the room.
 *
 *  - `DESKS` — the back-wall **battlestation arena**: glowing desks as set
 *    dressing (nobody sits at them now; the gamers walk in and stand). One is a
 *    dim "Reserved" desk for the next project.
 *  - `CAST` — each project's **character**: where they walk in to and settle,
 *    standing in a loose crowd up front facing the camera. Index-aligned to
 *    PROJECTS; `null` means no character (the reserved add-slot).
 *  - `ENTRANCE` — the point at the open front the characters walk in from.
 *
 * `faceY` is a yaw; a character/desk's local +Z is "forward".
 */

export type Desk = {
  pos: [number, number]
  faceY: number
  /** Monitor / RGB glow color. */
  hex: number
  /** The empty placeholder desk (dim monitor, "Reserved" plate, selectable). */
  reserved?: boolean
}

export const DESKS: Desk[] = [
  { pos: [-6, -7.1], faceY: 0, hex: 0xff3d6e },
  { pos: [-2, -7.1], faceY: 0, hex: 0xff7a38 },
  { pos: [2, -7.1], faceY: 0, hex: 0xffc23d },
  { pos: [6, -7.1], faceY: 0, hex: 0xa6f23d },
  { pos: [-8.3, -2.6], faceY: 0.85, hex: 0x5b8bff },
  { pos: [8.3, -2.6], faceY: -0.85, hex: 0xb39dff, reserved: true },
]

/** Camera-focus / fallback target for the reserved slot (its desk). */
export const RESERVED_POS: [number, number] = [8.3, -2.6]

/** The open front the gamers stroll in from on load. */
export const ENTRANCE: [number, number] = [0, 7.3]

export type CastSpot = {
  /** Where this gamer settles (and walks to). */
  home: [number, number]
  /** Facing once settled (toward the camera). */
  faceY: number
  /** Stagger (seconds) before they start walking in. */
  delay: number
}

// Index-aligned to PROJECTS. A loose two-row crowd up front facing the camera;
// `null` for the reserved add-slot (no character).
export const CAST: (CastSpot | null)[] = [
  { home: [-5.0, 2.0], faceY: 0.36, delay: 0.0 }, // kaisetsu
  { home: [-2.5, 1.8], faceY: 0.16, delay: 0.55 }, // fighter
  { home: [0.0, 2.1], faceY: 0.0, delay: 1.5 }, // apex-runner
  { home: [2.5, 1.8], faceY: -0.16, delay: 1.0 }, // flappy-ship
  { home: [5.0, 2.0], faceY: -0.36, delay: 0.3 }, // meet2explore
  { home: [-3.7, 4.4], faceY: 0.2, delay: 1.2 }, // cryptoflow
  { home: [-1.2, 4.7], faceY: 0.07, delay: 1.9 }, // infostream
  { home: [1.2, 4.7], faceY: -0.07, delay: 2.2 }, // one-piece-duel
  { home: [3.7, 4.4], faceY: -0.2, delay: 1.5 }, // anime-watchlist
  null, // add-slot — reserved desk, no character
]
