// AI Lounge — the local server.
//
// Runs the repo agents (server/agents.mjs): real Claude Code sessions in your
// repos, on your Claude Code login, streamed to the lounge.
//
// Endpoints:
//   GET  /api/health  → { ok, agents }
//   /api/agents/*     → repo agents (see server/agents.mjs)
//   everything else   → the built app from dist/ (so `npm start` is all you need)
//
// Listens on 127.0.0.1 only: repo agents can edit files and run commands, so
// nothing off this machine may reach it. Browser requests from other sites are
// refused too (Origin check + JSON-only POSTs, which force a CORS preflight
// this server never approves).
//
// Run with:  npm start        (builds the app, serves it here, opens the browser)
//       or:  npm run server   (just this; use with `npm run dev` while hacking on the UI)
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { agentCount, handleAgents, stopAllAgents } from './agents.mjs'

const PORT = Number(process.env.PORT || 8787)
const DIST = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'dist')
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
  '.json': 'application/json',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]'])

function isLocalRequest(req) {
  const host = String(req.headers.host ?? '').replace(/:\d+$/, '')
  if (!LOCAL_HOSTS.has(host)) return false // DNS-rebinding guard
  const origin = req.headers.origin
  if (origin) {
    try {
      if (!LOCAL_HOSTS.has(new URL(origin).hostname)) return false
    } catch {
      return false
    }
  }
  return true
}

/** Serves dist/ (hashed assets cached for good, everything else fresh). */
function serveApp(req, res, url) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return json(res, 404, { error: 'not found' })
  let file
  try {
    file = path.join(DIST, path.normalize(decodeURIComponent(url.pathname)))
  } catch {
    return json(res, 400, { error: 'bad path' })
  }
  if (!file.startsWith(DIST + path.sep) && file !== DIST) return json(res, 404, { error: 'not found' })
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    // Unknown paths without an extension are app routes → index.html.
    if (path.extname(file)) return json(res, 404, { error: 'not found' })
    file = path.join(DIST, 'index.html')
  }
  if (!fs.existsSync(file)) {
    res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' })
    return res.end('The app is not built yet. Run `npm start` (or `npm run dev` for development).')
  }
  res.writeHead(200, {
    'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream',
    'cache-control': url.pathname.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache',
  })
  if (req.method === 'HEAD') return res.end()
  fs.createReadStream(file).pipe(res)
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url ?? '/', 'http://localhost')
  if (!isLocalRequest(req)) return json(res, 403, { error: 'local requests only' })
  if (
    req.method === 'POST' &&
    url.pathname !== '/api/hooks/pretool' &&
    !String(req.headers['content-type'] ?? '').startsWith('application/json')
  ) {
    return json(res, 415, { error: 'JSON only' })
  }
  if (await handleAgents(req, res, url)) return

  if (req.method === 'GET' && url.pathname === '/api/health') {
    return json(res, 200, { ok: true, agents: agentCount() })
  }
  if (url.pathname.startsWith('/api/')) return json(res, 404, { error: 'not found' })
  serveApp(req, res, url)
})

server.listen(PORT, '127.0.0.1', () => {
  const url = `http://127.0.0.1:${PORT}`
  console.log(`AI Lounge on ${url}  (repos: ${agentCount()})`)
  if (process.argv.includes('--open')) {
    const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'explorer' : 'xdg-open'
    spawn(opener, [url], { stdio: 'ignore', detached: true }).on('error', () => {}).unref()
  }
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    stopAllAgents()
    process.exit(0)
  })
}
