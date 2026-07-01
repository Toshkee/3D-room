# CLAUDE.md

Guidance for Claude Code when working in this repo.

## What this is

**AI Lounge** — a cozy, stylized **isometric room** where a user's **AI bots**
hang out, work, and talk. Each bot is a flat circular portrait floating in the
room (always facing the camera) above a spot of furniture, with a live **status
pill** ("Working…", "Thinking…") that pulses while it's active.

Core surfaces:

- **Lounge** (default view) — the isometric 3D room (sofa, armchair, beanbag,
  coffee table, workstation desks, wall screen, plants). Click a bot to open its
  panel.
- **Bot panel** — a slide-in side panel: a live **activity feed** (streaming log
  lines you watch the bot "work") on top, a **1:1 chat** underneath.
- **Team chat** — a group channel where the **bots talk to each other** (and the
  user can jump in).
- **Dashboard** — a grid of every bot: role, current task, status, progress,
  latest activity.
- **Import a bot** — a modal: name, role, accent color, personality → the bot
  walks into an open seat.

Themes: **light is default** (airy, pastel), **dark** available via toggle
(deep neon-purple). One global **indigo/violet accent** (`ACCENT`) for UI chrome;
each **bot** also has its own accent used for its avatar/monitor/chat bubble.

> History: this repo was previously "Project Room" (a photoreal 3D gaming lounge
> with walking humanoid models). It was **fully redesigned** into AI Lounge — a
> stylized, flat-shaded isometric app. Don't reintroduce the photoreal humans,
> the Soldier.glb model, HDRI lighting, bloom postprocessing, or the
> project-as-gamer concept.

## Stack

- **Vite** + **React 19** + **TypeScript** (strict). `verbatimModuleSyntax` →
  use `import type`. `erasableSyntaxOnly` → **no enums, no namespaces, no
  constructor parameter properties** (declare class fields explicitly).
  `noUnusedLocals`/`noUnusedParameters`.
- **three** via **@react-three/fiber** (R3F) — an **orthographic** camera makes
  the true isometric view; furniture is flat-shaded low-poly geometry.
- **@react-three/drei** — `Html` (screen-space billboard bot badges),
  `RoundedBox` (soft furniture), `ContactShadows` (soft grounding).
- No postprocessing, no backend, no database. **localStorage is used only for
  the theme preference** — nothing else is persisted (the simulation is
  in-memory and resets on reload).

## The bot engine (the important seam)

All bot behavior flows through **`src/engine/BotEngine.ts`** — an interface the
UI talks to. Today it's the **`SimulatedBotEngine`** (timers + scripted,
role-flavored content in `engine/content.ts`). To make bots real later, implement
the same `BotEngine` interface with a **Claude-backed** engine and swap it in
`state/LoungeContext.tsx` — **the UI and state shape don't change.** The engine
never touches React; it pushes updates through `EngineHandlers`
(`onActivity` / `onStatus` / `onChat` / `onGroup`), and the provider applies them
to state. `getBots()` keeps the engine reading the live roster (incl. imports).

## Commands

- `npm install` — install dependencies
- `npm run dev` — dev server at http://localhost:5173
- `npm run build` — type-check (`tsc -b`) + production build to `dist/`
- `npm run typecheck` — type-check only

## Structure

- `index.html` — mount point + `<html data-theme="light">`
- `public/favicon.svg`
- `src/`
  - `main.tsx` — React root
  - `App.tsx` — `LoungeProvider` + shell: `TopBar`, the active view
    (Lounge/Dashboard/GroupChat), the `BotPanel` overlay, the `ImportBotModal`
  - `index.css` — **all** UI styling + theme tokens (`[data-theme]` + CSS vars)
  - `types.ts` — `Bot`, `Role`, `Status`, `ActivityLine`, `Message`, `View`, `Theme`
  - `theme.ts` — `ACCENT`, `ROLE_META` (glyph/label/default accent), `ROLES`,
    `ACCENT_SWATCHES`, and `ROOM[theme]` (flat furniture palette per theme)
  - `util.ts` — `fmtTime`, `clamp`
  - `usePrefersReducedMotion.ts`
  - `data/bots.ts` — **`CREW`** (seed bots, one per role), **`SEATS`** (room
    seat coords), `SEAT_Y`, `firstOpenSeat`
  - `engine/`
    - `BotEngine.ts` — the `BotEngine` interface + `EngineHandlers`
    - `SimulatedBotEngine.ts` — the timer-driven simulation
    - `content.ts` — all simulated content pools (tasks, activity lines, 1:1
      replies, group lines) + `pick`/`chance`/`keyword`
  - `state/LoungeContext.tsx` — the single store: bots, theme, view, selection,
    activity, chats, group; wires the engine; `useLounge()` hook
  - `scene/`
    - `Lounge3D.tsx` — `<Canvas orthographic>` + `CameraRig` (fit + pointer
      parallax) + composition
    - `Lighting.tsx` — flat hemisphere + gentle key lights (no shadow maps)
    - `Room.tsx` — floor, walls, rug, sofa/armchair/beanbag/table, desks,
      wall screen, frames, plants (all flat-shaded, theme-colored)
    - `BotAvatar.tsx` — a bot's floor ring + shadow disc + drei `Html` badge
  - `components/` — `TopBar`, `Avatar`, `StatusPill`, `ProgressBar`, `TypeLine`
    (typewriter), `ActivityFeed`, `ChatThread` (shared by panel + group),
    `BotPanel`, `Dashboard`, `GroupChat`, `ImportBotModal`

## Conventions

- **To add/seed a bot, edit `CREW` in `src/data/bots.ts`** (id, name, role,
  accent, blurb, `seat` index into `SEATS`, initial status/task/progress). At
  runtime, the **Import bot** modal calls `addBot` — it assigns the first open
  seat. To add a **role**, extend `Role` in `types.ts` and add entries to
  `ROLE_META`/`ROLES` and the content pools in `engine/content.ts`.
- **Simulated behavior lives entirely in `engine/`.** Add flavor by editing the
  pools in `content.ts`; change pacing/logic in `SimulatedBotEngine.ts`. Don't
  scatter fake content into components.
- **The scene is stylized, not photoreal.** Flat matte `meshStandardMaterial`
  (high roughness, no metalness), low-poly boxes/cylinders/spheres, `RoundedBox`
  for soft furniture. Only monitors/screens/frames use emissive accent
  (`toneMapped={false}`) — there's no bloom, so keep glows as bright surfaces.
- **Bots are drei `<Html>` billboards**, not 3D meshes — screen-space (constant
  size, which suits the orthographic camera), always facing the camera, and they
  are **real `<button>`s** (so they're clickable *and* keyboard-focusable). Their
  floor ring + shadow disc ARE meshes (animated in `useFrame`). Keep the badge a
  button so the non-pointer path to every bot stays intact.
- **Theming:** driven by `[data-theme]` on `<html>` + CSS variables in
  `index.css`; the 3D room reads `ROOM[theme]` from `theme.ts`. Light is the
  default. Persist only the theme (localStorage `ai-lounge-theme`).
- **Camera:** fixed isometric orthographic, fit to the viewport in `CameraRig`,
  with a subtle pointer parallax. No OrbitControls (it's an iso scene, not a
  free-orbit one). Under reduced motion the canvas is `frameloop="demand"`, so
  imperative camera changes must `invalidate()`.
- **Accessibility:** bot badges, dashboard cards, tabs are all buttons; the panel
  and modal close on Escape and manage focus; `prefers-reduced-motion` disables
  the typewriter, pulses, and parallax.
- **Mobile:** the panel/modal go full-width under 860px; `touch-action: none` on
  the canvas. Keep it usable on a phone.

## Roadmap

- **Real bots:** implement a `ClaudeBotEngine` against the `BotEngine` interface
  (needs an API key + a small proxy — the API can't be called safely from a pure
  frontend) and swap it in `LoungeContext`. The UI is already engine-agnostic.
- Richer activity (tool-call style lines, artifacts), persistent bots, and
  per-bot chat memory.
- **Deploy:** `npm run build`, host `dist/` (Vercel/Netlify/GitHub Pages;
  `base: './'` keeps asset paths relative).

## Notes

- Keep it a single self-contained app — no state libraries; the one store is
  `LoungeContext`. Don't over-engineer.
- Verify with `npm run build` (type-check + bundle). To smoke-test the live
  render, `npm run dev` and confirm zero console errors — the WebGL scene needs a
  real browser (Playwright/Chrome render WebGL2; note headless defaults
  `prefers-reduced-motion: reduce`, which freezes the parallax/typewriter).
