# CLAUDE.md

Guidance for Claude Code when working in this repo.

## What this is

**Project Room** — an interactive 3D **gaming lounge** where each of my projects
is a **realistic human gamer**. On load the camera cranes in (a cinematic open)
while the gamers **walk in from the entrance and disperse** into the lounge; from
then on they **roam on their own** — milling, pairing up to chat, gathering to
watch the big wall screen, or heading back to a workstation — continuously, not
frozen in place. Behind them sit a back-wall **battlestation arena** (glowing
desks) and a **lounge** (sofa / armchair / beanbag) in front of a big wall screen.
Click (or tap, or keyboard-select) a gamer and it comes to attention (turns to
face you) while the camera glides to it — tracking it as it walks — and a card
slides up with the blurb + link. It's a personal portfolio / hub piece that runs
in the browser.

> History: neon-isometric "pods" → a photoreal **gaming lounge** of *seated
> gamer-bots* (RobotExpressive) → **realistic humanoid models (the three.js
> "Soldier"/Vanguard) that walk in and settle**, tinted per project accent, with a
> cinematic camera intro → the current pass: those humans now **roam autonomously**
> (a per-agent DWELL↔TRAVEL state machine over a shared waypoint graph). The desks
> + lounge are now set dressing. Don't reintroduce the old pods/neon look or the
> seated-bot version (see git history / the `prefers-best-frameworks` +
> `project-room-state` memories).

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
- `public/` — **vendored assets**: `models/Soldier.glb` (the rigged human —
  three.js's "Soldier"/Vanguard, Mixamo/Adobe, free to use; Idle/Walk/Run clips),
  `hdri/lebombo.hdr` (image-based lighting), `previews/<id>.jpg` (per-project card
  preview images). Loaded via `import.meta.env.BASE_URL` so sub-path hosting works.
- `src/`
  - `main.tsx` — React root
  - `App.tsx` — `<Canvas>` (perspective, `shadows`, ACES tone mapping;
    `frameloop="demand"` under reduced-motion) + overlay (HUD + card) + selection
  - `index.css` — **all** HUD / card styling (neon glassmorphism — UI chrome only),
    keyboard-nav focus pill, `.sr-only`, reduced-motion rules
  - `theme.ts` — `PALETTE`/`HEX` (room surface colors), `ROOM` dims, asset URLs
  - `lowPower.ts` — coarse "is this a phone?" flag used to scale back GPU work
  - `usePrefersReducedMotion.ts` — live `prefers-reduced-motion` hook
  - `useTapSelect.ts` — shared tap-vs-drag + hover hook (used by `Person` + `Battlestation`)
  - `data/`
    - `projects.ts` — **PROJECT DATA**: the `PROJECTS` array (one gamer per entry)
    - `stations.ts` — `DESKS` (arena set-dressing desks, one `reserved`), `CAST`
      (each project's walk-in `home`/`faceY`/`delay`, index-aligned to PROJECTS;
      `null` = the reserved add-slot) + `ENTRANCE`/`RESERVED_POS`
    - `lounge.ts` — `LOUNGE`: shared lounge furniture layout (sofa/armchair/beanbag/
      table/rug), used by `Lounge.tsx` + `FoodDrinks.tsx` + `Decor.tsx`
    - `ambient.ts` — **autonomous-roaming layout**: the waypoint graph (front-stage
      MILL/CHAT/WATCH nodes + back DESK nodes + corridor transit points), the
      `pathTo`/`pathFromDeskTo` path builders, `chooseGoal` (weighted destination
      picker with screen-herding + chat-pairing), the `Occupancy` type, and the
      `AMBIENT` tuning constants (speeds, dwell ranges, weights, separation)
  - `scene/`
    - `Scene.tsx` — composes everything + the desks/people + `IntroCamera` (cinematic
      open) + `OrbitControls` (mounted only after the intro) + camera focus rig
      (follows the *live* position of the selected, roaming gamer) + `ContactShadows`.
      Owns the shared `positions` (id→Vector3) + `occupancy` refs threaded to every `Person`
    - `Lighting.tsx` — HDRI `Environment` + shadow-casting key light + warm fills
    - `Room.tsx` — floor, three walls + wainscot/baseboard/LED cove, ceiling panels, big wall screen
    - `Person.tsx` — loads the Soldier, skeleton-clones per instance, tints to accent,
      walks in from `ENTRANCE` to its `home`, then **roams autonomously** via a
      DWELL↔TRAVEL state machine (Idle/Walk/Run) over `ambient.ts`'s graph; nameplate
      + accent floor ring + select. Writes its live pos + claims/releases nodes via
      the shared refs
    - `Battlestation.tsx` — desk + gaming chair + glowing monitor + peripherals + RGB (set
      dressing); the `reserved` one is dim + selectable ("Reserved" plate)
    - `Lounge.tsx` — rug, sofa, armchair, beanbag, coffee table (laid out from `LOUNGE`)
    - `FoodDrinks.tsx` — pizza/cans/cups/bowl/bag on the coffee table + a stray can/bag on the rug (static)
    - `Decor.tsx` — plants, shelf, PC tower, pendant lamps (static)
    - `WallDressing.tsx` — framed art, "GAME ON" neon sign, clock, acoustic panels (static)
    - `Effects.tsx` — bloom + vignette
  - `components/`
    - `Hud.tsx` — title + controls hint
    - `ProjectCard.tsx` — the slide-up info panel (per-project preview image + a polite live region)

## Conventions

- Three is used through R3F (JSX `<mesh>`, `<meshStandardMaterial>`); import
  `* as THREE` only for enums/utilities (`THREE.MOUSE`, `THREE.TOUCH`, `THREE.MathUtils`, …).
- **To add or change a project, edit `PROJECTS` in `src/data/projects.ts` and add
  a matching `CAST` entry in `src/data/stations.ts` — never hand-place a gamer.**
  A project entry is `{ id, name, tag, hex, css, blurb, glyph?, link?, add?: true }`
  (`hex` = THREE accent → also tints the human, `css` = matching CSS accent,
  `glyph` = card emblem, `link` = wires "Open project →", `add: true` = the empty
  "Reserved" desk — give it a `null` `CAST` slot, no human). A `CAST` entry is
  `{ home: [x, z], faceY, delay }` (where the gamer walks to + settles, the yaw
  they face once there, and the walk-in stagger in seconds). `CAST` is
  **index-aligned to PROJECTS** — keep lengths equal. The arena `DESKS` are
  separate set dressing (not per-project). `faceY` is a yaw; local +Z is "forward".
- This is **photoreal-leaning, not neon**: lighting is HDRI + a real shadow key
  light; materials are PBR (`meshStandardMaterial`, roughness/metalness). Only
  genuinely bright emissive sources should glow — give them `toneMapped={false}`
  and `emissiveIntensity` ≥ ~1.5 so they cross the bloom threshold (0.9). Keep
  glows sparse (monitors, RGB strips, LED cove, signs). The HUD/card chrome keeps
  its neon look — that's 2D UI, not the scene.
- **Characters:** one model (`Soldier.glb`, the three.js Vanguard) is
  `SkeletonUtils.clone`d per gamer so each has an independent skeleton + mixer
  (`useAnimations`), then its body material (`/body/i`) is tinted toward the accent
  (team colors). It renders ~1.85m tall at **scale 1, feet at y=0** — `Box3`
  auto-fit is unreliable on this skinned mesh, so the scale/ground offset are fixed
  constants, verified visually. On load each walks `ENTRANCE → home` (Walk clip,
  facing the move direction) then settles; `active` ramps the body's accent
  self-glow (hover/select cue). Under reduced-motion they're **placed at `home` and
  frozen on a standing Idle frame** (no walk-in, no intro, no roaming).
- **Autonomous roaming** (`Person.tsx` FSM + `ambient.ts` graph): once the intro
  ends (`introDone`), each gamer runs ENTER→DWELL→TRAVEL. It almost always moves
  inside a **convex, furniture-free front "stage"** (so straight lines between
  waypoints never clip furniture); the only multi-hop trips are **desk excursions**
  down two pre-cleared corridors (x=±5 / z=−6). `chooseGoal` weights destinations
  (watch-the-screen herding, chat-pair forming) and **reserves nodes + corridors in
  the shared `occupancy` ref** so two gamers never target the same spot or corridor.
  A hard **`avoidOverlap`** (front-stage only) keeps bodies from interpenetrating,
  with a yield rule that stays stable and protects the focused gamer: the
  **selected** gamer never moves (others step around it), else the higher-id of a
  too-close pair steps out to `BODY_SEP`. Selecting a gamer makes it **come to
  attention** (finish its current leg, then face the camera, take no new goals)
  until deselected. Per-frame `delta` is clamped (R3F doesn't), so a tab-refocus
  spike can't teleport anyone. Tuning lives in `AMBIENT` (`ambient.ts`); don't
  hand-place waypoints elsewhere. The walk-in `CAST.home`s double as the initial
  mill spots (each gamer claims its coincident node on arrival).
- **Cinematic intro:** `IntroCamera` cranes from a low angle on the entering crowd
  up to the rest overview, then hands off. `OrbitControls` is **mounted only after
  the intro ends** — drei calls `controls.update()` every frame for damping, which
  would otherwise wrestle the camera away from `IntroCamera`. Any user input skips
  the intro. Disabled entirely under reduced-motion (starts settled).
- **Mobile matters.** Mouse *and* touch: single-finger drag = rotate, two-finger
  pinch = zoom, tap = select. Tap-vs-drag guard lives in `useTapSelect.ts` (touch
  gets a larger slop; the pointer cursor is only set for a real mouse so a tap on a
  hybrid device doesn't leave the cursor stuck). Don't break touch.
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
are intentionally excluded). Each is a human gamer tinted to its accent that walks
in, then roams the lounge on its own:

- **KAISETSU** — 2D soulslike (Godot)
- **Fighter** — fighting game (Unity)
- **ApexRunner** — endless runner (Unity)
- **Flappy Ship** — arcade game (TypeScript)
- **Meet2Explore** — social travel platform (full-stack)
- **CryptoFlow** — crypto futures trading platform (live demo)
- **InfoStream** — news/info web app (live demo)
- **One Piece Sword Duel** — 2-player browser game (live demo)
- **Anime Watchlist** — full-stack CRUD app
- **"Reserved" slot** — empty/dim battlestation, placeholder for the next project (`add: true`, no human)

## Roadmap

- ~~Wire real links per project~~ — **done**.
- ~~Real lighting, shadows, bloom, idle auto-rotate, camera focus-on-select~~ — **done**.
- ~~Characters that ARE the projects (seated gamers)~~ — **done** (GLTF bots).
- ~~Add a preview image inside the info card per project~~ — **done**
  (`public/previews/<id>.jpg`: live demos are real app screenshots, code repos use
  GitHub OG/README art; `ProjectCard` shows it with a graceful onError fallback).
- ~~Make the room a real lounge — bigger, with a seating area + TV, not everyone
  on a computer~~ — **done**: room enlarged to 19×16, split into a battlestation
  arena + a lounge nook (sofa/armchair/beanbag around a coffee table facing a big
  wall screen); 4 of the gamers now lounge instead of sitting at desks.
- ~~Realistic human models + characters that walk from place to place + a
  cinematic entrance~~ — **done**: swapped the seated bots for the rigged three.js
  Soldier (Vanguard), tinted per accent; on load they walk in from the entrance
  and settle (Walk→Idle) while the camera cranes in. (The *seated* realistic-human
  attempts failed earlier — head occluded by the monitor, accent-tint blended into
  the glow. The fix was to have them **stand/walk in the open**, not sit at desks.)
- ~~Make the gamers move on their own (to their workstation, get up, do
  something), instead of walking in once and freezing~~ — **done**: a per-agent
  DWELL↔TRAVEL state machine (`Person.tsx` + `ambient.ts`) — they mill, pair up to
  chat, gather to watch the wall screen, and take excursions to the back desks,
  continuously and without overlapping (shared node/corridor reservations).
- **Richer "do something" anims** (sit at a desk / type / wave): the Soldier rig
  only ships Idle/Walk/Run, so "working" is currently *standing at* the desk. A
  follow-up could source extra clips (Mixamo) — flagged as risky (retarget/scale).
- **Deploy:** `npm run build`, host `dist/` on GitHub Pages / Netlify / Vercel
  (`base: './'` is set; vendored assets load relative to it).

## Notes

- Keep it a single self-contained scene — no state libraries, don't over-engineer.
- When in doubt about the aesthetic, match the current photoreal gaming-lounge
  direction rather than reintroducing the old neon-pod look.
- Verify visually: `npm run dev`, then smoke-test headless (real Chrome /
  Playwright render WebGL2). The scene must load with zero console errors. Assets
  are async (model + HDRI) under `<Suspense>`; the loader veil hides on `onReady`.
- **Headless caveat:** Playwright headless throttles `requestAnimationFrame` to
  ~sub-1 fps and defaults `prefers-reduced-motion: reduce`. So static screenshots
  can't show the walk-in / camera crane / roaming (and the reduced default freezes
  everything). Pass `reducedMotion: 'no-preference'` to exercise the live path.
  Each `page.screenshot()` / `page.evaluate()` **forces a frame**, so a *burst* of
  them spaced ~1.3 s apart gives a big per-frame `delta` ≈ ~45 s of sim time in
  ~30 frames — `ffmpeg ... tile=` the burst into a montage to *see* the gamers in
  different spots. To verify roaming *quantitatively*, temporarily expose the
  shared `positions`/`occupancy` refs on `window` from `Scene.tsx` and sample them
  over a burst (confirm distance moved, node flavors visited, corridors used, min
  pair distance) — then remove the probe. (Don't trust pixel-diff alone: `autoRotate`
  is frame-count-based so it barely turns over a few forced frames, but it still
  confounds; the registry probe is the decisive check.)
