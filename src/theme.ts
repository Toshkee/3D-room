/**
 * Theme + room constants for the photoreal gaming lounge.
 *
 * The 3D scene is no longer neon-stylized — it's lit by an HDRI environment and
 * real shadow-casting lights (see `Lighting.tsx`). Each project keeps its accent
 * color, but inside the room that accent only drives *artificial* light sources
 * (a gamer's monitor glow, their RGB desk strip), not flat neon paint.
 *
 * The HUD / card chrome (`index.css`) keeps a tasteful neon look — that's UI.
 */

/** CSS color strings (UI chrome + a few scene tints). */
export const PALETTE = {
  base: '#0a0713',
  ink: '#f3eafe',
  muted: '#b39dff',
  magenta: '#ff3df0',
  cyan: '#4dd2ff',
} as const

/** THREE-friendly numeric colors for the room's physical surfaces (kept dark
 *  and desaturated so the colored screens + RGB strips read against them). */
export const HEX = {
  magenta: 0xff3df0,
  cyan: 0x4dd2ff,

  floor: 0x2a2029, // warm dark engineered wood
  carpet: 0x241f2b,
  wall: 0x211d28,
  wallLow: 0x191620, // wainscot / lower wall
  ceiling: 0x141019,
  trim: 0x0e0c13,
  desk: 0x2a2630,
  deskTop: 0x201d26,
  metal: 0x3a3741,
  plasticDark: 0x17151c,
  chair: 0x1b1920,
} as const

/** Interior dimensions, in meters. Floor sits at y = 0. */
export const ROOM = {
  W: 19, // x extent → interior x ∈ [-9.5, 9.5]
  D: 16, // z extent → interior z ∈ [-8, 8]; the +z (front) side is open for the camera
  H: 4.2, // wall height
} as const
export const HALF_W = ROOM.W / 2
export const HALF_D = ROOM.D / 2

/** Vendored CC0 assets (paths respect Vite's base so sub-path hosting works). */
const BASE = import.meta.env.BASE_URL
/** Soldier ("Vanguard") — rigged humanoid with Idle/Walk/Run clips; the gamers
 *  are clones of this, tinted per project accent, that walk in and settle. */
export const HUMAN_URL = `${BASE}models/Soldier.glb`
/** Interior HDRI for image-based lighting + reflections. */
export const HDRI_URL = `${BASE}hdri/lebombo.hdr`
