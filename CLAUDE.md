# CLAUDE.md

Guidance for Claude Code when working in this repo.

## What this is

**AI Lounge** — a cozy, stylized **isometric room** where a user's **AI bots**
hang out, work, and talk. Each bot is a cute low-poly **robot** that roams the
room, with a floating name tag + live **status pill** ("Working…", "Thinking…")
and a **speech bubble** showing what it just said. Where a robot goes and how
its body moves follows its status (see *The living room* below).

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
- **@react-three/drei** — `Html` (screen-space bot name tags + speech
  bubbles), `RoundedBox` (soft furniture), `OrbitControls`, `Sparkles`, `Grid`.
- **@react-three/postprocessing** — N8AO + restrained Bloom + Vignette + SMAA
  (`scene/Effects.tsx`); emissive screens/neon cross the bloom threshold.
- No database. **localStorage persists the theme** (`ai-lounge-theme`), the
  **sound toggle** (`ai-lounge-sound`, off by default) **and the
  lounge state** (`ai-lounge-state-v1`: bots, chats, group, activity, artifacts
  — debounced save in `LoungeContext`, hydrate on boot, "Reset lounge" button in
  the TopBar clears it). The Claude engine is re-seeded from saved chats so bots
  remember across reloads.

## The bot engine (the important seam)

All bot behavior flows through **`src/engine/BotEngine.ts`** — an interface the
UI talks to. There are two implementations:

- **`SimulatedBotEngine`** — timers + scripted, role-flavored content in
  `engine/content.ts`. Always available; the fallback.
- **`ClaudeBotEngine`** — real Claude conversations (1:1 chat, group chat,
  autonomous group chatter), Claude-generated activity-feed lines (batched, one
  call per ~12 lines per bot per task), and **assigned work** (`assignTask` →
  real deliverable → `onArtifact` → artifacts drawer in the BotPanel), all via
  the local proxy in **`server/index.mjs`**. Replies **stream**: the engine
  re-emits the same message id as text grows and the provider upserts by id
  (`onChat`/`onGroup` are upserts, not appends). Only task progress % stays
  timer-driven. The frontend only calls `/api/*` (Vite dev-proxies it to
  `localhost:8787`).

`LoungeContext` starts the simulation, probes `GET /api/health` on mount, and
hot-swaps in `ClaudeBotEngine` if the proxy is up — the TopBar shows
"live (Claude)" vs "simulated". The proxy picks its backend at startup:
with `ANTHROPIC_API_KEY` set it uses the Anthropic SDK (`CLAUDE_MODEL`
overrides the model, default haiku — see `server/index.mjs`); **without a key it shells out to
headless `claude -p` (Claude Code print mode), riding the user's Claude Code
subscription — no API credits needed** (capped at 2 concurrent CLI runs).
To run live: `npm run server` in one terminal, `npm run dev` in another.

The engine never touches React; it pushes updates through `EngineHandlers`
(`onActivity` / `onStatus` / `onChat` / `onGroup` / `onArtifact`), and the
provider applies them to state. `getBots()` keeps the engine reading the live
roster (incl. imports).

## The living room (scene behavior)

The 3D room reacts to the engine through **scene cues** — `state/sceneBus.ts`,
a tiny pub/sub outside React (not app state, never persisted). `LoungeContext`
emits them from the engine handlers: `say` (a bot's chat/group text → its speech
bubble, re-emitted as a reply streams), `typing` (reply being composed → typing
dots), `celebrate` (status → done), `converse` (bot A addressed bot B in the team
channel, by @mention or by replying within 25s). It also marks imported bots as
`entering` (they walk in through the door) and tracks who is typing at a desk
(`setKeys`, for keyboard sounds). Consumers: `BotAvatar` (bubble via
`useSpeech`), `scene/Conductor.tsx` (turns `converse` into one bot walking over
to the other), and `audio/loungeAudio.ts`.

- **Status drives behavior** (`data/roam.ts` → `chooseGoal`/`suits`/`dwellFor`):
  *working* → sits at a desk and types (the desk's monitor + lamp take the bot's
  accent via `world.using`), or works on a laptop on the sofa when desks are
  taken; *thinking* → paces slowly with a hand on its chin, browses the
  bookshelf, scribbles on the whiteboard; *idle* → arcades (whose screens show a
  score), pool table, sofa/armchair/beanbag, vending machine (leaves sipping a
  can); *done* → hop + confetti burst. Selecting a bot makes it stop and wave.
- **Shared scene state** is `scene/world.ts` (`World`): positions (also read by
  the camera), node claims, agents (status, conversation, visits), furniture in
  use, door state. Created once per canvas, mutated in `useFrame` — never React
  state. `BotAvatar` keeps its FSM + pose smoothing in refs.
- **Walkway graph:** every edge in `roam.ts` is a hand-checked clear segment.
  When you move furniture in `Room.tsx`/`Decor.tsx`, re-check the nearby edges.
- **Ambience:** `scene/Decor.tsx` (window onto the real sky by local time +
  sun/moon patch on the floor, wall clock, bookshelf, posters, rolling sprint
  whiteboard with each bot's live task, warm flickering lamps, steaming mug, the
  door), `scene/Roomba.tsx`, neon buzz + swaying plants in `Room.tsx`. Canvas
  art (code on monitors, arcade games, sky, posters, whiteboard) is drawn in
  `scene/canvasArt.ts` — no image assets. `?hour=17.5` overrides the clock.
- **Sound** (`audio/loungeAudio.ts`): synthesized Web Audio — lo-fi chord bed,
  keyboard clicks while bots type, a chime on done, a blip on speech. Off until
  the user enables it in the TopBar.

## Commands

- `npm install` — install dependencies
- `npm run dev` — dev server at http://localhost:5173
- `npm run server` — Claude proxy at http://localhost:8787 (API key if set, else `claude -p`)
- `npm run build` — type-check (`tsc -b`) + production build to `dist/`
- `npm run typecheck` — type-check only

## Structure

- `index.html` — mount point + `<html data-theme="light">`
- `public/favicon.svg`
- `src/`
  - `main.tsx` — React root (StrictMode — effects mount twice in dev)
  - `App.tsx` — `LoungeProvider` + shell: `TopBar`, the active view
    (Lounge/Dashboard/GroupChat), the `BotPanel` overlay, the `ImportBotModal`
  - `index.css` — **all** UI styling + theme tokens (`[data-theme]` + CSS vars)
  - `types.ts` — `Bot`, `Role`, `Status`, `ActivityLine`, `Message`, `View`, `Theme`
  - `theme.ts` — `ACCENT`, `ROLE_META` (glyph/label/default accent), `ROLES`,
    `ACCENT_SWATCHES`, and `ROOM[theme]` (flat furniture palette per theme)
  - `util.ts` — `fmtTime`, `clamp`
  - `usePrefersReducedMotion.ts`
  - `data/bots.ts` — **`CREW`** (seed bots, one per role), **`SEATS`** (room
    seat coords), `LABEL_Y`, `firstOpenSeat`
  - `data/roam.ts` — the walkway graph (nodes per activity), status-driven goal
    choice, dwell times, walk speeds
  - `engine/`
    - `BotEngine.ts` — the `BotEngine` interface + `EngineHandlers`
    - `SimulatedBotEngine.ts` — the timer-driven simulation
    - `content.ts` — all simulated content pools (tasks, activity lines, 1:1
      replies, group lines) + `pick`/`chance`/`keyword`
  - `state/LoungeContext.tsx` — the single store: bots, theme, sound, view,
    selection, activity, chats, group, artifacts; wires the engine; emits scene
    cues; `useLounge()` hook
  - `state/sceneBus.ts` — scene cues (speech, typing, celebrate, converse,
    entering, desk typing) + `useSpeech`
  - `audio/loungeAudio.ts` — the synthesized sound layer
  - `scene/`
    - `Lounge3D.tsx` — `<Canvas orthographic>` + composition; owns the `World`
    - `CameraRig.tsx` — intro crane, OrbitControls (azimuth clamped to the open
      side of the room), follow-the-selected-bot, idle ping-pong orbit
    - `Lighting.tsx` — hemisphere + key (one shadow caster, warms at golden
      hour) + rim + front fill
    - `Effects.tsx` — post pipeline (AO, bloom, vignette, SMAA)
    - `Room.tsx` — floor, walls, rugs, sofa corner, desks (chair, lamp, code
      monitor), arcades, wall screen, neon, vending, pool table, plants
    - `Decor.tsx` — window/sky + sun patch, clock, bookshelf, posters,
      whiteboard, lamps, mug, door
    - `BotAvatar.tsx` — the robot: status-driven FSM, poses, props (laptop,
      book, can, cue), confetti, name tag + `SpeechBubble`
    - `SpeechBubble.tsx`, `Conductor.tsx`, `Roomba.tsx`, `world.ts`,
      `canvasArt.ts`, `timeOfDay.ts`, `softShadow.tsx`
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
  for soft furniture. Screens/neon/lamps use emissive color (`toneMapped={false}`)
  and bloom picks up only those. Point lights are a fixed set (3 desk lamps +
  2 lamps) — vary intensity, don't add/remove lights at runtime (shader
  recompiles).
- **Bots are low-poly robot meshes** with a drei `<Html>` name tag whose badge is
  a **real `<button>`** (clickable *and* keyboard-focusable) — keep it a button
  so the non-pointer path to every bot stays intact. The speech bubble sits in
  the same `<Html>` and is `aria-hidden` (the text lives in the chat views).
- **Theming:** driven by `[data-theme]` on `<html>` + CSS variables in
  `index.css`; the 3D room reads `ROOM[theme]` from `theme.ts`. Light is the
  default.
- **Camera:** orthographic; OrbitControls for rotate/zoom (no pan), azimuth
  clamped so walls never block the view. Under reduced motion the canvas is
  `frameloop="demand"`, so imperative camera changes must `invalidate()`; bots
  hold their spots and the intro/auto-orbit/sway/steam are off.
- **Accessibility:** bot badges, dashboard cards, tabs are all buttons; the panel
  and modal close on Escape and manage focus; `prefers-reduced-motion` disables
  the typewriter, pulses, and parallax.
- **Mobile:** the panel/modal go full-width under 860px; the TopBar drops the
  brand text under 620px and the logo under 440px so its buttons fit a 390px
  phone; `touch-action: none` on the canvas. Keep it usable on a phone.

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
