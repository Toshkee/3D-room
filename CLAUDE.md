# CLAUDE.md

Guidance for Claude Code when working in this repo.

## What this is

**Project Room** — an interactive 3D **gaming lounge** where each of my projects
is a gamer seated at their own battlestation. Click (or tap, or keyboard-select)
a gamer and the camera glides to them while a card slides up with the blurb +
link. It's a personal portfolio / hub piece that runs in the browser.

> History: it started as a neon-isometric room of floating "pods." It was then
> rebuilt into a **perspective, photoreal-leaning gaming lounge** where the
> characters *are* the projects (see git history / the `prefers-best-frameworks`
> memory). Don't reintroduce the old pods/neon-grid look.

## Stack

- **Vite** + **React 19** + **TypeScript** (strict: `verbatimModuleSyntax` → use
  `import type`; `noUnusedLocals`/`noUnusedParameters`)
- **three** via **@react-three/fiber** (R3F) — declarative Three.js
- **@react-three/drei** — `OrbitControls`, `Environment` (HDRI/IBL),
  `ContactShadows`, `useGLTF` + `useAnimations`, `Billboard`, `Text`
- **three-stdlib** — `SkeletonUtils.clone` (per-instance skinned clones)
- **@react-three/postprocessing** — restrained **bloom** (only bright emissive
  sources glow now) + vignette
- No backend, no database, **no `localStorage`** — everything is in-memory

## Commands

- `npm install` — install dependencies
- `npm run dev` — dev server at http://localhost:5173 (hot reload)
- `npm run build` — type-check (`tsc -b`) + production build to `dist/`
- `npm run preview` — serve the built `dist/` locally
- `npm run typecheck` — type-check only

## Structure

- `index.html` — mount point + meta (viewport locked so pinch zooms the scene)
- `public/` — **vendored CC0 assets**: `models/RobotExpressive.glb` (the gamer
  bot), `hdri/lebombo.hdr` (image-based lighting), `previews/<id>.jpg` (per-project
  card preview images). Loaded via `import.meta.env.BASE_URL` so sub-path hosting works.
- `src/`
  - `main.tsx` — React root
  - `App.tsx` — `<Canvas>` (perspective, `shadows`, ACES tone mapping;
    `frameloop="demand"` under reduced-motion) + overlay (HUD + card) + selection
  - `index.css` — **all** HUD / card styling (neon glassmorphism — UI chrome only),
    keyboard-nav focus pill, `.sr-only`, reduced-motion rules
  - `theme.ts` — `PALETTE`/`HEX` (room surface colors), `ROOM` dims, asset URLs
  - `lowPower.ts` — coarse "is this a phone?" flag used to scale back GPU work
  - `usePrefersReducedMotion.ts` — live `prefers-reduced-motion` hook
  - `data/`
    - `projects.ts` — **PROJECT DATA**: the `PROJECTS` array (one gamer per entry)
    - `stations.ts` — `STATIONS`: where each gamer sits (index-aligned to PROJECTS)
  - `scene/`
    - `Scene.tsx` — composes everything + `OrbitControls` + camera focus rig + `ContactShadows`
    - `Lighting.tsx` — HDRI `Environment` + shadow-casting key light + warm fills
    - `Room.tsx` — floor, three walls + wainscot/baseboard/LED cove, ceiling panels, wall TV
    - `GamerCharacter.tsx` — loads RobotExpressive, skeleton-clones per instance, tints to accent, plays "Sitting"
    - `GamingStation.tsx` — desk + gaming chair + accent monitor + peripherals + RGB + nameplate + the seated bot + click/tap select
    - `Lounge.tsx` — rug, sofa, coffee table
    - `FoodDrinks.tsx` — pizza/cans/cups/bowl/bag on the coffee table (static)
    - `Decor.tsx` — plants, shelf, PC tower, pendant lamps, beanbag (static)
    - `WallDressing.tsx` — framed art, "GAME ON" neon sign, clock, acoustic panels (static)
    - `Effects.tsx` — bloom + vignette
  - `components/`
    - `Hud.tsx` — title + controls hint
    - `ProjectCard.tsx` — the slide-up info panel (per-project preview image + a polite live region)

## Conventions

- Three is used through R3F (JSX `<mesh>`, `<meshStandardMaterial>`); import
  `* as THREE` only for enums/utilities (`THREE.MOUSE`, `THREE.TOUCH`, `THREE.MathUtils`, …).
- **To add or change a project, edit `PROJECTS` in `src/data/projects.ts` and add
  a matching seat to `STATIONS` in `src/data/stations.ts` — never hand-place a
  station.** A project entry is
  `{ id, name, tag, hex, css, blurb, glyph?, link?, add?: true }`
  (`hex` = THREE accent, `css` = matching CSS accent, `glyph` = card emblem,
  `link` = wires "Open project →", `add: true` = the empty "Reserved" station).
  A station entry is `{ pos: [x, z], faceY }` (faceY orients the gamer toward
  the room center). The arrays are **index-aligned** — keep their lengths equal.
- This is **photoreal-leaning, not neon**: lighting is HDRI + a real shadow key
  light; materials are PBR (`meshStandardMaterial`, roughness/metalness). Only
  genuinely bright emissive sources should glow — give them `toneMapped={false}`
  and `emissiveIntensity` ≥ ~1.5 so they cross the bloom threshold (0.9). Keep
  glows sparse (monitors, RGB strips, LED cove, signs). The HUD/card chrome keeps
  its neon look — that's 2D UI, not the scene.
- **Characters:** one model (`RobotExpressive.glb`) is `SkeletonUtils.clone`d per
  station so each has an independent skeleton + mixer (`useAnimations`), then its
  "Main" material is tinted to the project accent. The "Sitting" clip is a floor
  sit raised onto the chair on purpose. Under reduced-motion the action is applied
  at full weight then paused (don't `fadeIn` — weight would be 0 on the static frame).
- **Mobile matters.** Mouse *and* touch: single-finger drag = rotate, two-finger
  pinch = zoom, tap = select. Tap-vs-drag guard lives in `GamingStation.tsx`
  (touch gets a larger slop). Don't break touch.
- **Accessibility matters.** The 3D meshes aren't focusable, so `App.tsx` renders
  a visually-hidden keyboard-reachable `.pod-nav` that opens each gamer; the card
  manages focus, uses `inert` when closed, and a `.sr-only` live region announces
  the open project. Keep a non-pointer path to every project.
- **Performance:** `pixelRatio` capped at 2; `LOW_POWER` (pointer:coarse) scales
  down shadow-map size, `ContactShadows` resolution/frames, and composer MSAA.
  Under reduced-motion the canvas renders on demand (`frameloop="demand"`); the
  damped camera/hover loops self-`invalidate()` until they settle. Keep tiny
  clutter from casting shadows. It must stay smooth on a phone.

## Current gamers

Pulled from real shipped projects on **github.com/Toshkee** (course/lab exercises
are intentionally excluded). Each is a seated gamer-bot tinted to its accent.

- **KAISETSU** — 2D soulslike (Godot)
- **Fighter** — fighting game (Unity)
- **ApexRunner** — endless runner (Unity)
- **Flappy Ship** — arcade game (TypeScript)
- **Meet2Explore** — social travel platform (full-stack)
- **CryptoFlow** — crypto futures trading platform (live demo)
- **InfoStream** — news/info web app (live demo)
- **One Piece Sword Duel** — 2-player browser game (live demo)
- **Anime Watchlist** — full-stack CRUD app
- **"Reserved" slot** — empty desk, placeholder for the next project (`add: true`)

## Roadmap

- ~~Wire real links per project~~ — **done**.
- ~~Real lighting, shadows, bloom, idle auto-rotate, camera focus-on-select~~ — **done**.
- ~~Characters that ARE the projects (seated gamers)~~ — **done** (GLTF bots).
- ~~Add a preview image inside the info card per project~~ — **done**
  (`public/previews/<id>.jpg`: live demos are real app screenshots, code repos use
  GitHub OG/README art; `ProjectCard` shows it with a graceful onError fallback).
- **Swap the gamer-bots for realistic human GLTF models** — *attempted* (Mixamo
  "Soldier": auto-scaled, hip-pinned, posed seated over the Idle clip) and
  reverted: a seated human's head sits at monitor height (occluded by the
  camera-facing monitor), and tinted to the accent it blends into the monitor
  glow — it read worse than the bots. Would need smaller/repositioned monitors +
  a clothed (non-accent-tinted) model. Localized to `GamerCharacter.tsx`.
- **Deploy:** `npm run build`, host `dist/` on GitHub Pages / Netlify / Vercel
  (`base: './'` is set; vendored assets load relative to it).

## Notes

- Keep it a single self-contained scene — no state libraries, don't over-engineer.
- When in doubt about the aesthetic, match the current photoreal gaming-lounge
  direction rather than reintroducing the old neon-pod look.
- Verify visually: `npm run dev`, then smoke-test headless (real Chrome /
  Playwright render WebGL2). The scene must load with zero console errors. Assets
  are async (model + HDRI) under `<Suspense>`; the loader veil hides on `onReady`.
