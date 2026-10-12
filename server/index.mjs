// AI Lounge — the local server.
//
// Runs the repo agents (server/agents.mjs): real Claude Code sessions in your
// repos, on your Claude Code login, streamed to the lounge.
//
// Endpoints:
//   GET  /api/health  → { ok, agents }
//   /api/agents/*     → repo agents (see server/agents.mjs)
//
// Listens on 127.0.0.1 only: repo agents can edit files and run commands, so
// nothing off this machine may reach it. Browser requests from other sites are
// refused too (Origin check + JSON-only POSTs, which force a CORS preflight
// this server never approves).
//
// Run with:  npm run server
import http from 'node:http'
import { agentCount, handleAgents, stopAllAgents } from './agents.mjs'

const PORT = Number(process.env.PORT || 8787)

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
  json(res, 404, { error: 'not found' })
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`AI Lounge server on http://127.0.0.1:${PORT}  (repos: ${agentCount()})`)
})

for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    stopAllAgents()
    process.exit(0)
  })
}
