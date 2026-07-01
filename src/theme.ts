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
  ambient: number
  dirLight: number
  fill: number
  fog: string
}

export const ROOM: Record<Theme, RoomPalette> = {
  light: {
    floor: '#f0e9de',
    floorAlt: '#e7ddcf',
    rug: '#d7cff5',
    wallBack: '#f0ebfc',
    wallLeft: '#e8e2f8',
    sofa: '#c3bceb',
    sofaCushion: '#dad3f6',
    wood: '#caa987',
    desk: '#b6a6ee',
    cabinet: '#4a4270',
    cabinetTop: '#332c52',
    plantPot: '#cf9070',
    plantLeaf: '#57b78a',
    screen: '#241d3c',
    frame: '#f9f6ff',
    neonA: '#6d5efc',
    neonB: '#ff5fa2',
    neonC: '#2aa7ff',
    cove: '#8b7bff',
    gridCell: '#ded5f2',
    gridSection: '#c6b6ee',
    hemiSky: '#ffffff',
    hemiGround: '#d8cfe6',
    ambient: 0.65,
    dirLight: 0.9,
    fill: 0.4,
    fog: '#ece6f9',
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
    ambient: 0.62,
    dirLight: 0.85,
    fill: 0.55,
    fog: '#0c0920',
  },
}
