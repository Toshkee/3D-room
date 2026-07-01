import type { Role, Theme } from './types'

// One global accent (indigo/violet) — active UI states, focus, brand, primary
// buttons. Per-bot accents live on each Bot.
export const ACCENT = '#6d5efc'

// Per-role presentation: a human label + a sensible default accent the import
// form pre-fills. (Role icons come from lucide — see components/icons.tsx.)
export const ROLE_META: Record<Role, { label: string; accent: string }> = {
  engineer: { label: 'Engineer', accent: '#6d5efc' },
  researcher: { label: 'Researcher', accent: '#2aa7ff' },
  designer: { label: 'Designer', accent: '#ff5fa2' },
  writer: { label: 'Writer', accent: '#14b8a6' },
  analyst: { label: 'Analyst', accent: '#f5a524' },
  coordinator: { label: 'Coordinator', accent: '#22c55e' },
}

export const ROLES: Role[] = [
  'engineer',
  'researcher',
  'designer',
  'writer',
  'analyst',
  'coordinator',
]

export const ACCENT_SWATCHES = [
  '#6d5efc',
  '#2aa7ff',
  '#14b8a6',
  '#22c55e',
  '#f5a524',
  '#ff7a45',
  '#ff5fa2',
  '#a35bff',
]

// Room / furniture colors for the 3D scene, per theme. Flat, stylized, playful —
// not PBR. Neon fields drive the arcade glow (emissive, toneMapped off).
export interface RoomPalette {
  floor: string
  floorAlt: string
  rug: string
  wallBack: string
  wallLeft: string
  sofa: string
  sofaCushion: string
  wood: string
  desk: string
  cabinet: string
  cabinetTop: string
  plantPot: string
  plantLeaf: string
  screen: string
  frame: string
  neonA: string
  neonB: string
  neonC: string
  cove: string
  gridCell: string
  gridSection: string
  hemiSky: string
  hemiGround: string
  keyColor: string
  fillColor: string
  ambient: number
  dirLight: number
  fill: number
  fog: string
}

export const ROOM: Record<Theme, RoomPalette> = {
  light: {
    floor: '#f2e8d5',
    floorAlt: '#e2d2b8',
    rug: '#cbb8f3',
    wallBack: '#ece4fb',
    wallLeft: '#dbd2f4',
    sofa: '#b6ade8',
    sofaCushion: '#d3cbf7',
    wood: '#c99d70',
    desk: '#a596ee',
    cabinet: '#443c6e',
    cabinetTop: '#2e2750',
    plantPot: '#d18d67',
    plantLeaf: '#4cb485',
    screen: '#221b3a',
    frame: '#fdfaff',
    neonA: '#6d5efc',
    neonB: '#ff5fa2',
    neonC: '#2aa7ff',
    cove: '#8b7bff',
    gridCell: '#d6cbef',
    gridSection: '#bfaeec',
    hemiSky: '#fff6ea',
    hemiGround: '#d2c5ec',
    keyColor: '#fff2dc',
    fillColor: '#c7daff',
    ambient: 0.5,
    dirLight: 1.15,
    fill: 0.5,
    fog: '#e9e2f6',
  },
  dark: {
    floor: '#221a42',
    floorAlt: '#1b1436',
    rug: '#31266a',
    wallBack: '#1d1642',
    wallLeft: '#160f34',
    sofa: '#41347a',
    sofaCushion: '#50429a',
    wood: '#5a4570',
    desk: '#3e3080',
    cabinet: '#2c2364',
    cabinetTop: '#1d1648',
    plantPot: '#5c4a76',
    plantLeaf: '#49ac88',
    screen: '#0b0818',
    frame: '#352a63',
    neonA: '#9a8bff',
    neonB: '#ff79b6',
    neonC: '#4fbdff',
    cove: '#a294ff',
    gridCell: '#33285e',
    gridSection: '#5f4dbb',
    hemiSky: '#6a5da8',
    hemiGround: '#120e28',
    keyColor: '#cabaff',
    fillColor: '#3f57c9',
    ambient: 0.58,
    dirLight: 0.9,
    fill: 0.62,
    fog: '#0c0920',
  },
}
