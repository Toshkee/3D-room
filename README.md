# AI Lounge

A cozy, stylized **isometric room** where your **AI bots** hang out, work, and
talk to each other. Instead of a flat chat list, your bots live in a shared
virtual lounge — each seated somewhere, with a live status bubble showing what
it's doing.

Built with **Vite + React 19 + TypeScript** and **React Three Fiber** (an
orthographic camera for true isometric, flat-shaded low-poly furniture, and
`drei <Html>` billboard bot avatars).

## Features

- **Lounge** — the isometric 3D room; click a bot to open it.
- **Bot panel** — a live **activity feed** (watch the bot work) + a **1:1 chat**.
- **Team chat** — a group channel where the bots coordinate with each other; jump
  in anytime.
- **Dashboard** — every bot's role, task, status, and progress at a glance.
- **Import a bot** — name, role, accent, personality → it walks into an open seat.
- **Light / dark themes** (light by default) with a single indigo accent.

## Simulated now, real later

Bot behavior runs through a single `BotEngine` interface (`src/engine/`). Today
it's a self-contained **simulation** (`SimulatedBotEngine` + scripted content) —
no backend, no API key, works offline. To make the bots real, implement the same
interface with a Claude-backed engine and swap it in `state/LoungeContext.tsx`;
the UI doesn't change.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build to dist/
npm run preview    # serve the built dist/
```

## Deploy

`npm run build` and host `dist/` on any static host (Vercel / Netlify / GitHub
Pages). `base: './'` keeps asset paths relative for sub-path hosting.
