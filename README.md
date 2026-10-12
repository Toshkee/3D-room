# AI Lounge

A cozy, stylized **isometric room** where each of your **repos** gets a little
robot. Click one, tell it what to do, and it works in that repo with a real
**Claude Code** session on your own login, while you watch it in the room:
sitting at a desk when it's working, raising a hand when it needs your OK,
hopping when it's done.

Built with **Vite + React 19 + TypeScript** and **React Three Fiber**, plus a
small local Node server that runs Claude Code headless in your repos.

## Features

- **Lounge**: the isometric 3D room; click a bot to open it.
- **Bot panel**: chat with the bot, a live **activity feed** of every tool call,
  **Allow / Deny** for edits and commands, model + effort per bot, and
  **Changes**: the files each run touched, with the diff.
- **Dashboard**: every repo at a glance, with who needs you, who's working, and
  what the last run changed.
- **Add repo**: pick a project folder (git repos under `~` are suggested) and
  its bot walks in through the door.
- **Light / dark themes** and optional ambient sound.

## Run it

You need [Claude Code](https://code.claude.com) installed and logged in.

```bash
npm install
npm run server     # the lounge server, http://127.0.0.1:8787 (one terminal)
npm run dev        # the app, http://localhost:5173 (another terminal)
```

Then press **Add repo**. Repos live in `lounge.agents.json` (gitignored; see
`lounge.agents.example.json`). The server only listens on `127.0.0.1` and
refuses requests from other sites, because these agents can edit files and run
commands.

## Develop

```bash
npm run build      # type-check + production build to dist/
npm run typecheck  # type-check only
```
