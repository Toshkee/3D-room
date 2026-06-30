/**
 * Where each gamer sits. One station per PROJECTS entry (index-aligned).
 *
 * Stations ring three walls and face *inward* (toward the room center), so the
 * camera looking in from the open fourth side sees faces + the colored monitor
 * glow wrapping each gamer. `faceY` is the yaw the whole station is rotated by;
 * inside a station, "forward" (+Z) is the direction the gamer looks (desk +
 * monitor sit there).
 */
export type Station = {
  /** Floor position of the seat [x, z]. */
  pos: [number, number]
  /** Yaw so the gamer faces the room center. */
  faceY: number
}

// 4 along the back wall (face +Z), 3 along each side wall (face the center).
export const STATIONS: Station[] = [
  { pos: [-5.6, -5.3], faceY: 0 }, // back row
  { pos: [-1.9, -5.3], faceY: 0 },
  { pos: [1.9, -5.3], faceY: 0 },
  { pos: [5.6, -5.3], faceY: 0 },
  { pos: [-6.3, -3.4], faceY: 0.5 }, // left wall
  { pos: [-6.3, 0.2], faceY: 0.5 },
  { pos: [-6.3, 3.6], faceY: 0.5 },
  { pos: [6.3, -3.4], faceY: -0.5 }, // right wall
  { pos: [6.3, 0.2], faceY: -0.5 },
  { pos: [6.3, 3.6], faceY: -0.5 },
]
