/**
 * PROJECT DATA — the single source of truth that drives every pod in the room.
 *
 * To add or change a project, edit this array. Never hand-place pod meshes:
 * each pod (its platform, glow, beam, floating crystal and label) is generated
 * from one entry here, and positions are auto-arranged by `layout.ts`.
 *
 * These are pulled from github.com/Toshkee — real shipped projects, not the
 * course/lab exercises.
 */

export type Project = {
  /** Stable identifier (used as React key + selection key). */
  id: string
  /** Display name shown on the label and in the card. */
  name: string
  /** Short category tag, e.g. "2D Soulslike · Godot". */
  tag: string
  /** Accent color as a THREE-friendly hex number. */
  hex: number
  /** Matching CSS color string for the HUD / card. */
  css: string
  /** One- or two-sentence description for the info card. */
  blurb: string
  /** Optional manual floor position [x, z]; defaults to the auto-layout slot. */
  pos?: [number, number]
  /** Outbound link — live demo if there is one, else the repo. */
  link?: string
  /** A short monochrome glyph rendered inside the card chip. */
  glyph?: string
  /** True for the empty "+" slot — the placeholder for the next project. */
  add?: boolean
}

export const PROJECTS: Project[] = [
  {
    id: 'kaisetsu',
    name: 'KAISETSU',
    tag: '2D Soulslike · Godot',
    hex: 0xff3d6e,
    css: '#ff3d6e',
    glyph: '⚔︎',
    blurb:
      'A punishing 2D soulslike built in Godot (GDScript) — deliberate combat, stamina-gated swings, and hard-won victories.',
    link: 'https://github.com/Toshkee/Kaisetsu',
  },
  {
    id: 'fighter',
    name: 'Fighter',
    tag: 'Fighting Game · Unity',
    hex: 0xff7a38,
    css: '#ff7a38',
    // Monochrome dingbat (impact spark). Avoids emoji-default codepoints like a
    // raised fist, which fall back to multicolor emoji and ignore the accent.
    glyph: '✶',
    blurb:
      'A 1-on-1 fighting game built in Unity (C#) — combos, blocks, and health-bar duels.',
    link: 'https://github.com/Toshkee/Fighter',
  },
  {
    id: 'apex-runner',
    name: 'ApexRunner',
    tag: 'Endless Runner · Unity',
    hex: 0xffc23d,
    css: '#ffc23d',
    glyph: '➤',
    blurb:
      'A fast-paced endless runner built in Unity (C#) — dodge, dash, and chase the high score.',
    link: 'https://github.com/Toshkee/ApexRunner',
  },
  {
    id: 'flappy-ship',
    name: 'Flappy Ship',
    tag: 'Arcade Game · TypeScript',
    hex: 0xa6f23d,
    css: '#a6f23d',
    glyph: '✈︎',
    blurb:
      'A Flappy-Bird-style arcade game in TypeScript — thread your ship through the gaps and keep flying.',
    link: 'https://github.com/Toshkee/flappy-ship',
  },
  {
    id: 'meet2explore',
    name: 'Meet2Explore',
    tag: 'Social Travel · Full-Stack',
    hex: 0x3df08f,
    css: '#3df08f',
    glyph: '⚑',
    blurb:
      'A social travel-planning platform for Montenegro — build trips, discover destinations, and find compatible travel partners.',
    link: 'https://github.com/Toshkee/Meet2Explore-Frontend',
  },
  {
    id: 'cryptoflow',
    name: 'CryptoFlow',
    tag: 'Trading Platform · Full-Stack',
    hex: 0x3df0d2,
    css: '#3df0d2',
    glyph: '₿',
    blurb:
      'A real-time crypto futures trading platform — live Binance charts, order books, and simulated trade execution.',
    link: 'https://cryptofloww.netlify.app/',
  },
  {
    id: 'infostream',
    name: 'InfoStream',
    tag: 'News App · Web',
    hex: 0x3dc9ff,
    css: '#3dc9ff',
    glyph: '☰',
    blurb:
      'A web app that pulls the day’s news and info into one clean, live stream. Deployed on Vercel.',
    link: 'https://infostream2.vercel.app',
  },
  {
    id: 'one-piece-duel',
    name: 'One Piece Sword Duel',
    tag: '2-Player Game · Web',
    hex: 0x5b8bff,
    css: '#5b8bff',
    // Nautical star (monochrome dingbat) — an anchor codepoint is emoji-default
    // and would render as a colored emoji on some platforms.
    glyph: '✪',
    blurb:
      'A 2-player browser sword duel inspired by One Piece — Zoro vs Shanks, one-minute fights to the last hit. Playable in the browser.',
    link: 'https://toshkee.github.io/One-Piece-Sword-Duel/',
  },
  {
    id: 'anime-watchlist',
    name: 'Anime Watchlist',
    tag: 'Full-Stack CRUD · Web',
    hex: 0xc46bff,
    css: '#c46bff',
    glyph: '▶︎',
    blurb:
      'A full-stack anime watchlist — browse, add custom entries with poster uploads (Cloudinary), and manage your list behind auth.',
    link: 'https://github.com/Toshkee/anime-watchlist',
  },
  {
    id: 'add-slot',
    name: 'New Project',
    tag: 'Coming soon',
    hex: 0xb39dff,
    css: '#b39dff',
    glyph: '+',
    blurb:
      'An empty pad, waiting for the next idea. Whatever ships next lights up right here.',
    add: true,
  },
]
