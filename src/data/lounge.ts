/**
 * The lounge "living room" — now set dressing (the gamers roam + stand, they
 * don't sit here). It sits toward the back, in front of the big wall screen, so
 * the front + middle of the room stay clear for the characters who walk in and
 * gather there. Shared by `Lounge.tsx` (furniture), `FoodDrinks.tsx` and
 * `Decor.tsx` (lamps) so everything lines up.
 *
 * Convention: each piece is built in a local space where its front faces local
 * +Z (backrest at local −Z), then rotated by `faceY`. `faceY = Math.PI` faces
 * −Z, i.e. toward the screen on the back wall.
 */
export const LOUNGE = {
  rug: { pos: [0, -3.4] as [number, number], w: 7.2, d: 4.8 },
  table: { pos: [0, -3.6] as [number, number], topY: 0.45, w: 1.6, d: 0.9 },
  sofa: {
    pos: [0, -2.3] as [number, number],
    faceY: Math.PI, // faces −Z (toward the wall screen)
    seatGap: 0.98,
  },
  armchair: {
    pos: [2.8, -3.7] as [number, number],
    faceY: Math.PI + 0.5,
  },
  beanbag: {
    pos: [-2.7, -3.6] as [number, number],
    faceY: Math.PI - 0.4,
  },
} as const
