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
- **Bot panel**: chat with the bot (formatted answers: code, lists, tables), a
  live **activity feed** of every tool call, **Allow / Deny** for edits and
  commands, model + effort per bot, and **Changes**: the files each run
  touched, with the diff.
- **History on the server**: chats, feed and changes are kept by the lounge
  server (`server/.agents-history.json`), so closing the tab mid-run loses
  nothing.
- **Notifications** (bell in the top bar): a system notification when a bot
  needs your OK or finishes while the lounge is in the background.
- **Dashboard**: every repo at a glance, with who needs you, who's working, and
  what the last run changed.
- **Add repo**: pick a project folder (git repos under `~` are suggested) and
  its bot walks in through the door.
- **Light / dark themes** and optional ambient sound.

## Run it

You need [Claude Code](https://code.claude.com) installed and logged in.

```bash
npm install
npm start          # builds the app, serves it at http://127.0.0.1:8787 and opens it
```

Or install it as a Mac app (its own window and Dock icon, no terminal):

```bash
npm run app        # builds and installs /Applications/AI Lounge.app
```

Then press **Add repo**. Repos live in `lounge.agents.json` (gitignored; see
`lounge.agents.example.json`). The server only listens on `127.0.0.1` and
refuses requests from other sites, because these agents can edit files and run
commands.

## Develop

```bash
npm run server     # the lounge server alone, http://127.0.0.1:8787
npm run dev        # the app with hot reload, http://localhost:5173 (proxies /api)
npm run build      # type-check + production build to dist/
npm run typecheck  # type-check only
```
