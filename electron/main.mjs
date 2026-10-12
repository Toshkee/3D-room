// AI Lounge as a Mac app: the same lounge server, started inside the app, and
// the lounge in its own window. Closing the window keeps the bots working (and
// notifying); the Dock icon brings it back; Cmd+Q stops everything.
//
// Build + install:  npm run app   (→ /Applications/AI Lounge.app)
// Try from source:  npm run app:dev
import { app, BrowserWindow, dialog, shell } from 'electron'
import { execFileSync } from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

// Its own port and data folder, so the app never collides with `npm start`
// (port 8787, data in the repo) running at the same time.
const PORT = 8790
const ORIGIN = `http://127.0.0.1:${PORT}`
process.env.PORT = String(PORT)
process.env.LOUNGE_DATA_DIR ||= app.getPath('userData') // ~/Library/Application Support/AI Lounge

// Apps opened from Finder get a bare PATH (/usr/bin:/bin…), but the bots need
// yours: `claude` (via nvm), node, npm, git… Ask the login shell for it once.
function loginShellPath() {
  try {
    const out = execFileSync(process.env.SHELL || '/bin/zsh', ['-ilc', 'printf "__PATH__%s__PATH__" "$PATH"'], {
      encoding: 'utf8',
      timeout: 8000,
      stdio: ['ignore', 'pipe', 'ignore'],
    })
    return out.match(/__PATH__(.*)__PATH__/s)?.[1] ?? ''
  } catch {
    return ''
  }
}
const home = os.homedir()
process.env.PATH = [
  loginShellPath(),
  process.env.PATH,
  '/opt/homebrew/bin',
  '/usr/local/bin',
  path.join(home, '.local/bin'),
  path.join(home, '.claude/local'),
]
  .filter(Boolean)
  .join(':')

if (!app.requestSingleInstanceLock()) app.quit()

let win = null
let server = null
let quitting = false

function createWindow() {
  win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    title: 'AI Lounge',
    titleBarStyle: 'hiddenInset',
    trafficLightPosition: { x: 18, y: 24 },
    backgroundColor: '#f2effe',
    show: false,
    webPreferences: { contextIsolation: true, sandbox: true },
  })
  // ?shell=mac: the page leaves room for the traffic lights and lets you drag
  // the window by its top bar.
  win.loadURL(`${ORIGIN}/?shell=mac`)
  win.once('ready-to-show', () => win?.show())
  // Links in replies open in your browser; the window never leaves the lounge.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(ORIGIN)) {
      e.preventDefault()
      if (/^https?:/.test(url)) shell.openExternal(url)
    }
  })
  // "(2) AI Lounge" → a "2" badge on the Dock icon: bots waiting for your OK.
  win.on('page-title-updated', (_e, title) => app.dock?.setBadge(title.match(/^\((\d+)\)/)?.[1] ?? ''))
  win.on('closed', () => (win = null))
}

function showWindow() {
  if (!win) createWindow()
  else {
    if (win.isMinimized()) win.restore()
    win.show()
    win.focus()
  }
}

app.on('second-instance', showWindow)
app.on('activate', showWindow)
// Closing the window keeps the app (and the bots) running, like other Mac apps.
app.on('window-all-closed', () => {})

app.on('before-quit', (e) => {
  if (quitting || !server) return
  const busy = server.busyAgents()
  if (busy.length) {
    const choice = dialog.showMessageBoxSync({
      type: 'warning',
      buttons: ['Quit', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      message: `${busy.join(', ')} ${busy.length === 1 ? 'is' : 'are'} still working.`,
      detail: 'Quitting stops the run. Changes made so far stay in the repo.',
    })
    if (choice === 1) {
      e.preventDefault()
      return
    }
  }
  quitting = true
  server.stopServer()
})

app.whenReady().then(async () => {
  try {
    const mod = await import(pathToFileURL(path.join(app.getAppPath(), 'server', 'index.mjs')).href)
    const agents = await import(pathToFileURL(path.join(app.getAppPath(), 'server', 'agents.mjs')).href)
    await mod.startServer({ port: PORT })
    server = { stopServer: mod.stopServer, busyAgents: agents.busyAgents }
  } catch (err) {
    dialog.showErrorBox(
      'AI Lounge could not start',
      err?.code === 'EADDRINUSE'
        ? `Port ${PORT} is already in use — is AI Lounge already open?`
        : String(err?.stack ?? err),
    )
    app.exit(1)
    return
  }
  // LOUNGE_HIDDEN=1: server only, no window or Dock icon (for checking a build).
  if (process.env.LOUNGE_HIDDEN === '1') app.dock?.hide()
  else createWindow()
})
