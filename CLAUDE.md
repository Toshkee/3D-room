# CLAUDE.md

Guidance for Claude Code when working in this repo.

## What this is

**AI Lounge** — a cozy, stylized **isometric room** where each of the user's
**repos** gets a cute low-poly **robot**. Every bot is a **real Claude Code
session in that repo** (run headless by the local server, on the user's own
Claude Code login). The robot roams the room with a floating name tag + live
**status pill** ("Working…", "Needs you") and a **speech bubble** showing what
it just said. Where a robot goes and how its body moves follows its status (see
*The living room* below).

Core surfaces:

- **Lounge** (default view) — the isometric 3D room. Click a bot to open its
  panel. With no repos yet, an empty-state card asks you to start the server or
  add a repo.
- **Bot panel** — the repo path, the **Allow / Deny** card when the bot waits
  on you, **Stop** / **New session**, a trash button (**Remove**, asks once;
  disabled while it runs), a folded settings chip (`model · effort` →
  model/effort/auto-approve), one **Activity | Changes** tab area
  (live feed; one row per run that changed files), and the **chat** you give
  it work through. The chat gets the most height; a reply whose run changed
  files carries a **View diff** chip. The composer is an auto-growing textarea
  (Enter sends, Shift+Enter new line) that keeps the draft but won't send while
  the bot is busy or the server is offline, and says why. Bot replies render
  as Markdown (`components/Markdown.tsx`: react-markdown + remark-gfm, no raw
  HTML, code blocks with a copy button); your own messages stay plain text.
- **Diff dialog** (`DiffModal`) — per-file sections with sticky headers,
  old/new line numbers, git's bookkeeping lines hidden; file chips jump to a
  file; Copy diff copies the raw diff.
- **Dashboard** — one card per repo: status, what it's doing or last did, who
  needs you, last run (when, files changed, cost) — plus a dashed *Add a repo*
  card.
- **Add repo** — a modal: folder (git repos under `~` are suggested), bot name,
  color → the server writes `lounge.agents.json` and the bot walks in the door.

There are no invented/simulated bots, no team chat and no personas any more —
those were removed on purpose (they burned Claude limits on make-believe). Don't
bring them back.

Themes: **light is default** (airy, pastel), **dark** available via toggle
(deep neon-purple). One global **indigo/violet accent** (`ACCENT`) for UI chrome;
each **bot** also has its own accent used for its avatar/monitor/chat bubble.

> History: this repo was previously "Project Room" (a photoreal 3D gaming lounge
> with walking humanoid models), then a lounge of simulated AI bots. Don't
> reintroduce the photoreal humans, the Soldier.glb model, HDRI lighting, or
> the simulated crew.

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
- **server/** — plain Node (no deps): `index.mjs` (routing + guards) and
  `agents.mjs` (repo agents).
- No database. The **server** owns the roster (`lounge.agents.json`), the
  sessions (`server/.agents-state.json`) and the **history** — chat, activity,
  changes per repo (`server/.agents-history.json`, all gitignored); every SSE
  snapshot carries the history and the page replaces its copy with it.
  **localStorage** keeps the theme (`ai-lounge-theme`), the **sound** and
  **notification** toggles (`ai-lounge-sound`, `ai-lounge-notify`, both off by
  default) and an offline copy of what the page showed (`ai-lounge-state-v2`).

## Repo agents (the important seam)

**`server/agents.mjs`** runs headless Claude Code *in the repo* per message
(`claude -p … --resume <session> --output-format stream-json`, stdin closed) and
streams it to the browser over **SSE** (`GET /api/agents/events`). On the
client, **`engine/RepoAgentLink.ts`** maps those events onto `LinkHandlers`
(tool calls → activity lines, final answer → chat, changed files → a `Change`,
plus roster / removed / permission / run stats / connection), and
`LoungeContext` applies them to state. Bot ids are `repo-<agent id>`.

- **Roster:** `lounge.agents.json` (gitignored; template
  `lounge.agents.example.json`: id, name, path, accent, blurb?, model, effort,
  autoEdits). The UI adds (`POST /api/agents`) and removes
  (`POST /api/agents/:id/remove`) entries; `GET /api/agents/suggest` lists git
  repos up to two levels under `~` (skipping macOS privacy-guarded folders like
  Desktop/Documents/Downloads so the scan never triggers a permission prompt).
- **Approvals:** every tool call hits a `PreToolUse` **HTTP hook** pointing back
  at the server (`/api/hooks/pretool`, random per-process token,
  `onFailure: "block"`). Read-only tools and read-only shell commands
  (`isReadOnlyShell`, deliberately conservative) are allowed at once; edits
  (unless the bot's *Auto-approve edits* is on) and everything else are held
  open until the user presses **Allow / Deny**. A waiting bot has status
  **`waiting`** ("Needs you"): it raises a hand, its ring pulses amber, the tab
  title shows `(n) AI Lounge`, the Dashboard tab shows a count, and an
  attention sound plays.
- **Changes:** before and after each run the server snapshots the working tree
  against the same base commit (`git diff <base>` per file + untracked files'
  mtimes) and reports only what differs — so the user's own uncommitted work
  isn't attributed to the bot, and changes it commits still show.
- **Connection:** `RepoAgentLink` keeps the SSE stream open and retries every
  3 s while the server is down; the TopBar shows connected/offline and an
  offline strip appears. Saved bots stay in the room (idle) while offline.
- Session ids, model/effort, autoEdits and the last run persist in
  `server/.agents-state.json`. "New session" forgets the context and clears the
  chat thread (server-side, for every open tab).
- **History:** the server builds every feed line ("Started…", tool calls,
  "You allowed the step", "Finished · …"), stores your messages (under the id
  the page sent) and each final answer, and the runs that changed files. The
  page only maps events onto state — don't create feed lines client-side.
- **Notifications** (`src/notify.ts`): browser notifications (→ macOS
  Notification Center) for "needs your OK", "done" and "stopped early", only
  while the lounge tab isn't focused; clicking one opens that bot. Toggled by
  the bell in the TopBar, which asks the browser for permission.
- **Security:** the server listens on **127.0.0.1 only**, refuses non-local
  Host/Origin headers and non-JSON POSTs (so other sites can't drive an agent
  through the browser). Keep it that way — these agents can edit files and run
  commands.
- **Product note:** for the user's own use this rides their Claude Code
  subscription. Anthropic's docs don't allow third-party products to route
  other people's usage through their Pro/Max login — if this ever ships to
  others, it needs API-key auth (or Anthropic's approval).

## The living room (scene behavior)

The 3D room reacts through **scene cues** — `state/sceneBus.ts`, a tiny
pub/sub outside React (not app state, never persisted). `LoungeContext` emits
them from the link handlers: `say` (a bot's reply → its speech bubble,
re-emitted as it streams), `typing` (reply being composed → typing dots),
`celebrate` (status → done), `attention` (needs your OK). It also marks newly
added bots as `entering` (they walk in through the door) and tracks who is
typing at a desk (`setKeys`, for keyboard sounds). Consumers: `BotAvatar`
(bubble via `useSpeech`) and `audio/loungeAudio.ts`.

- **Status drives behavior** (`data/roam.ts` → `chooseGoal`/`suits`/`dwellFor`):
  *working* → sits at a desk and types (the desk's monitor + lamp take the bot's
  accent via `world.using`), or works on a laptop on the sofa when desks are
  taken; *thinking* → paces slowly with a hand on its chin, browses the
  bookshelf, scribbles on the whiteboard; *idle* → arcades (whose screens show a
  score), pool table, sofa/armchair/beanbag, vending machine (leaves sipping a
  can); *done* → hop + confetti burst; *waiting* → stops, faces the camera,
  raises a hand. Selecting a bot makes it stop and wave (other bots step
  aside for it). The floating status pill shows only when it's not *idle*.
- **`scene/Conductor.tsx`** pairs two *free* bots (idle/done) now and then: one
  walks over, they face each other and gesture. Pure body language — no text,
  no Claude calls.
- **Shared scene state** is `scene/world.ts` (`World`): positions (also read by
  the camera), node claims, agents (status, conversation, visits), furniture in
  use, door state. Created once per canvas, mutated in `useFrame` — never React
  state. `BotAvatar` keeps its FSM + pose smoothing in refs.
- **Walkway graph:** every edge in `roam.ts` is a hand-checked clear segment.
  When you move furniture in `Room.tsx`/`Decor.tsx`, re-check the nearby edges.
- **Ambience:** `scene/Decor.tsx` (window onto the real sky by local time +
  sun/moon patch on the floor, wall clock, bookshelf, posters, rolling
  whiteboard with each bot's current task, warm flickering lamps, steaming mug,
  the door), `scene/Roomba.tsx`, neon buzz + swaying plants in `Room.tsx`.
  Canvas art (code on monitors, arcade games, sky, posters, whiteboard) is drawn
  in `scene/canvasArt.ts` — no image assets. `?hour=17.5` overrides the clock.
- **Sound** (`audio/loungeAudio.ts`): synthesized Web Audio — lo-fi chord bed,
  keyboard clicks while bots type, a chime on done, a ping when a bot needs you,
  a blip on speech. Off until the user enables it in the TopBar.

## Commands

- `npm install` — install dependencies
- `npm start` — builds the app (`vite build`), then the server serves it at
  http://127.0.0.1:8787 and opens the browser. The daily way to use it.
- `npm run server` — the lounge server alone (also serves `dist/` if built)
- `npm run dev` — the app with hot reload at http://localhost:5173 (proxies
  `/api` to the server) — for working on the lounge itself
- `npm run build` — type-check (`tsc -b`) + production build to `dist/`
- `npm run typecheck` — type-check only

## Structure

- `index.html` — mount point + `<html data-theme="light">`
- `server/index.mjs` — routing + local-only guards + `/api/health` + serving
  `dist/`;
  `server/agents.mjs` — repo agents, add/remove/suggest, the approval hook,
  change tracking, SSE
- `lounge.agents.example.json` — template for the gitignored `lounge.agents.json`
- `public/favicon.svg`
- `src/`
  - `main.tsx` — React root (StrictMode — effects mount twice in dev)
  - `App.tsx` — `LoungeProvider` + shell: `TopBar`, `OfflineBanner`, the active
    view (Lounge with its empty state / Dashboard), the `BotPanel` overlay, the
    `AddRepoModal`
  - `index.css` — **all** UI styling + theme tokens (`[data-theme]` + CSS vars)
  - `types.ts` — `Bot` (with `agent: RepoLink`), `Status` (incl. `waiting`),
    `ActivityLine`, `Message`, `Change`/`ChangedFile`, `PermissionRequest`,
    `AgentRun`, `Connection`, `View`, `Theme`
  - `theme.ts` — `ACCENT`, `ACCENT_SWATCHES`, and `ROOM[theme]` (flat furniture
    palette per theme)
  - `util.ts` — `fmtTime`, `fmtAgo`, `clamp`, `mixHex`, `hash01`
  - `notify.ts` — system notifications (permission, pref, show-when-hidden)
  - `usePrefersReducedMotion.ts`
  - `data/bots.ts` — **`SEATS`** (room seat coords), `LABEL_Y`, `firstOpenSeat`
  - `data/roam.ts` — the walkway graph (nodes per activity), status-driven goal
    choice, dwell times, walk speeds
  - `engine/RepoAgentLink.ts` — client for the server (SSE in, POST out;
    `MODELS`, `EFFORTS`, `agentBotId`)
  - `state/LoungeContext.tsx` — the single store: bots, theme, sound, view,
    selection, connection, activity, chats, changes, permissions, runs; wires the
    link; emits scene cues; `useLounge()` hook
  - `state/sceneBus.ts` — scene cues (speech, typing, celebrate, attention,
    entering, desk typing) + `useSpeech`
  - `audio/loungeAudio.ts` — the synthesized sound layer
  - `scene/`
    - `Lounge3D.tsx` — `<Canvas orthographic>` + composition; owns the `World`
    - `CameraRig.tsx` — intro crane, OrbitControls (azimuth clamped to the open
      side of the room), follow-the-selected-bot, idle ping-pong orbit; on a
      portrait screen it frames the bots instead of the whole room; it leaves
      your zoom alone until you've been hands-off for 8 s (or pick a bot)
    - `Lighting.tsx` — hemisphere + key (one shadow caster, warms at golden
      hour) + rim + front fill
    - `Effects.tsx` — post pipeline (AO, bloom, vignette, SMAA)
    - `Room.tsx` — floor, walls, rugs, sofa corner, desks (chair, lamp, code
      monitor), arcades, wall screen, neon, vending, pool table, plants
    - `Decor.tsx` — window/sky + sun patch, clock, bookshelf, posters,
      whiteboard, lamps, mug, door
    - `BotAvatar.tsx` — the robot: status-driven FSM, poses, props (laptop,
      book, can, cue), confetti, name tag + `SpeechBubble`
    - `Conductor.tsx` — occasional meet-ups between free bots
    - `SpeechBubble.tsx`, `Roomba.tsx`, `world.ts`, `canvasArt.ts`,
      `timeOfDay.ts`, `softShadow.tsx`
  - `components/` — `TopBar`, `Avatar`, `RobotFace`, `StatusPill`, `TypeLine`
    (typewriter + `useTyped`), `Markdown`, `DiffModal`, `ActivityFeed`, `ChatThread`, `BotPanel`, `Dashboard`,
    `AddRepoModal`, `EmptyState` (+ `OfflineBanner`), `icons`

## Conventions

- **Bots come from the server roster only.** To add one, use *Add repo* (or edit
  `lounge.agents.json` and restart the server). Never seed fake bots in code.
- **The scene is stylized, not photoreal.** Flat matte `meshStandardMaterial`
  (high roughness, no metalness), low-poly boxes/cylinders/spheres, `RoundedBox`
  for soft furniture. Screens/neon/lamps use emissive color (`toneMapped={false}`)
  and bloom picks up only those. Point lights are a fixed set (3 desk lamps +
  2 lamps) — vary intensity, don't add/remove lights at runtime (shader
  recompiles).
- **Bots are low-poly robot meshes** with a drei `<Html>` name tag whose badge is
  a **real `<button>`** (clickable *and* keyboard-focusable) — keep it a button
  so the non-pointer path to every bot stays intact. The speech bubble sits in
  the same `<Html>` and is `aria-hidden` (the text lives in the chat).
  Its CSS class is `.speech` — `.bubble` belongs to chat messages; don't reuse it.
- **Theming:** driven by `[data-theme]` on `<html>` + CSS variables in
  `index.css`; the 3D room reads `ROOM[theme]` from `theme.ts`. Light is the
  default.
- **Camera:** orthographic; OrbitControls for rotate/zoom (no pan), azimuth
  clamped so walls never block the view. Under reduced motion the canvas is
  `frameloop="demand"`, so imperative camera changes must `invalidate()`; bots
  hold their spots and the intro/auto-orbit/sway/steam are off.
- **Accessibility:** bot badges, dashboard cards, tabs, repo suggestions are all
  buttons; the panel and modal close on Escape and manage focus (focus effects
  key on an id or `[]`, never on objects that change every tick);
  `prefers-reduced-motion` disables the typewriter, pulses, and parallax.
- **Mobile:** the panel/modal go full-width under 860px; the TopBar drops the
  brand text under 620px and the logo under 440px so its buttons fit a 390px
  phone; `touch-action: none` on the canvas. Keep it usable on a phone.

## Roadmap

- Image attachments in the chat (paste/drag a screenshot → saved outside the
  repo → path handed to the agent, which reads it with the Read tool).
- Repo dev servers run by the lounge (Start/Stop, logs, open link).
- A bot editor (look, personality → appended system prompt, approval rules).
- Packaging as a desktop app (Electron + Claude Agent SDK) — see the product
  note above about auth.

## Notes

- Keep it a single self-contained app — no state libraries; the one store is
  `LoungeContext`. Don't over-engineer.
- Verify with `npm run build` (type-check + bundle). To smoke-test the live
  render, run `npm start` (or `npm run server` + `npm run dev`) and confirm
  zero console errors —
  the WebGL scene needs a real browser (Playwright/Chrome render WebGL2; note
  headless defaults `prefers-reduced-motion: reduce`, which freezes the
  parallax/typewriter). Stop the servers when done.
