# Project Room

An interactive 3D **gaming lounge**, in the browser, where each of my projects is
a **realistic human gamer**. On load the camera cranes in while the gamers walk in
from the entrance and spread into the lounge — and from then on they **roam on
their own**: milling about, pairing up to chat, gathering to watch the big wall
screen, or heading back to a workstation. Behind them are a back-wall
**battlestation arena** of glowing desks and a **lounge** (sofa, armchair, beanbag)
in front of the screen. Click (or tap, or keyboard-select) a gamer and it turns to
face you while the camera glides over to track it, and a card slides up with the
project's blurb and a link to its repo or live demo.

Everyone is generated from a data array of my real
[github.com/Toshkee](https://github.com/Toshkee) projects — the humans, their
accent colors, walk-in positions and nameplates all come from one `PROJECTS` list
plus a matching `CAST` chart.

![Project Room](docs/preview.png)

## Stack

- **[Vite](https://vite.dev/)** + **React 19** + **TypeScript**
- **[three](https://threejs.org/)** via **[@react-three/fiber](https://r3f.docs.pmnd.rs/)** — declarative Three.js
- **[@react-three/drei](https://drei.docs.pmnd.rs/)** — `OrbitControls`, `Environment` (HDRI lighting), `ContactShadows`, `useGLTF` + `useAnimations`, `Text`, `Billboard`
- **[@react-three/postprocessing](https://react-postprocessing.docs.pmnd.rs/)** — a restrained **bloom** so only the screens / RGB / signs glow

Lighting is image-based (a vendored HDRI) plus a shadow-casting key light;
materials are physically-based. The characters are one rigged humanoid model (the
three.js "Soldier"/Vanguard, with Idle/Walk/Run clips) skeleton-cloned per gamer
and tinted to each project's accent; they walk in on load, then roam the lounge
autonomously via a small per-gamer state machine over a shared waypoint graph.

No backend, no database, no `localStorage` — the scene is entirely in-memory.

## Commands

```bash
npm install      # install dependencies
npm run dev      # dev server at http://localhost:5173 (HMR)
npm run build    # type-check + production build to dist/
npm run preview  # serve the built dist/ locally
npm run typecheck
```

## Project structure

```
index.html              # mount point + meta
public/
  models/Soldier.glb           # the rigged human (three.js Vanguard; Idle/Walk/Run)
  hdri/lebombo.hdr             # interior HDRI for image-based lighting
  previews/<id>.jpg            # per-project card preview images
src/
  main.tsx              # React root
  App.tsx               # Canvas (perspective, shadows) + overlay + state
  index.css             # all HUD / card styling (neon UI chrome)
  theme.ts              # palette + room dimensions + asset URLs
  useTapSelect.ts       # shared tap-vs-drag + hover hook
  data/
    projects.ts         # PROJECT DATA — the single source of truth
    stations.ts         # DESKS (arena set dressing) + CAST (walk-in homes) + ENTRANCE
    lounge.ts           # LOUNGE — shared lounge furniture layout (sofa/chair/beanbag/table)
    ambient.ts          # roaming waypoint graph + path builders + destination picker + tuning
  scene/
    Scene.tsx           # composes the room + desks/people + cinematic intro + controls + focus rig
    Lighting.tsx        # HDRI environment + key light + warm fills
    Room.tsx            # floor, walls, ceiling, LED cove, big wall screen
    Person.tsx          # loads + clones + tints the human; walks in, then roams (DWELL/TRAVEL FSM)
    Battlestation.tsx   # desk, chair, glowing monitor, peripherals (set dressing; reserved one selectable)
    Lounge.tsx          # rug, sofa, armchair, beanbag, coffee table
    FoodDrinks.tsx      # pizza, cans, cups, snacks
    Decor.tsx           # plants, shelf, PC tower, pendant lamps
    WallDressing.tsx    # framed art, neon sign, clock, acoustic panels
    Effects.tsx         # bloom + vignette
  components/
    Hud.tsx             # title + controls hint
    ProjectCard.tsx     # slide-up info panel
```

## Adding or changing a project

Add an entry to `PROJECTS` in [`src/data/projects.ts`](src/data/projects.ts)
**and** a matching `CAST` entry in
[`src/data/stations.ts`](src/data/stations.ts) (the arrays are index-aligned).
Everything else — the human, their tint, walk-in and nameplate — is generated:

```ts
// projects.ts
{
  id: 'my-thing',
  name: 'My Thing',
  tag: 'Web App',
  hex: 0x4dd2ff,          // THREE accent color (tints the human, monitors, RGB)
  css: '#4dd2ff',         // matching CSS accent for the card
  glyph: '✦',             // small emblem shown in the card
  blurb: 'One or two sentences for the info card.',
  link: 'https://…',      // optional: wires the "Open project →" button
}

// stations.ts — CAST (same index): where the gamer walks to + settles
{ home: [2.5, 1.8], faceY: -0.16, delay: 1.0 }   // [x, z] spot, yaw (local +Z = forward), walk-in stagger (s)
```

Set `add: true` on a project and give it a `null` `CAST` slot for the empty
"Reserved" desk (no human). The arena `DESKS` are separate set dressing.

## Controls

| Action | Mouse | Touch | Keyboard |
| --- | --- | --- | --- |
| Rotate | drag | one-finger drag | — |
| Zoom | scroll | two-finger pinch | — |
| Select | click a gamer | tap a gamer | Tab to a gamer, Enter |
| Close card | × / `Esc` | × | `Esc` |

## Deploy

`npm run build`, then host `dist/` on any static host (GitHub Pages, Netlify,
Vercel). Asset paths are relative (`base: './'`, and the model/HDRI load via
`import.meta.env.BASE_URL`), so sub-path hosting works.
