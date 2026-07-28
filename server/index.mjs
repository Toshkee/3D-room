// AI Lounge — tiny Claude proxy.
//
// Two interchangeable backends, picked automatically at startup:
//   - "api": the Anthropic SDK (needs ANTHROPIC_API_KEY / Console credits)
//   - "claude-code": headless `claude -p` — rides your Claude Code
//     subscription, no API credits needed. Used whenever no key is set.
//
// Endpoints:
//   GET  /api/health  → { ok, backend, model, effort }
//   POST /api/reply   → { text }                      (body.stream falsy)
//   POST /api/reply   → chunked text/plain deltas     (body.stream: true)
//
// Run with:  npm run server
import http from 'node:http'
import { spawn } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

const PORT = Number(process.env.PORT || 8787)
// Cheapest by default (user preference). API mode wants the full id; CLI mode
// wants an alias — CLAUDE_MODEL overrides either.
const MODEL = process.env.CLAUDE_MODEL || 'claude-haiku-4-5'
const CLI_MODEL = process.env.CLAUDE_MODEL || 'haiku'
const EFFORT = process.env.CLAUDE_EFFORT || 'medium'
const HAS_KEY = Boolean(process.env.ANTHROPIC_API_KEY)
const BACKEND = HAS_KEY ? 'api' : 'claude-code'

// Run `claude -p` from a neutral empty directory — otherwise it loads this
// repo's CLAUDE.md as project context and the bots break character (they start
// talking about the codebase instead of staying in persona).
const NEUTRAL_CWD = fs.mkdtempSync(path.join(os.tmpdir(), 'ai-lounge-'))

// --- backend: Anthropic API --------------------------------------------------

async function replyViaApi({ system, messages, maxTokens = 400 }, onDelta) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk')
  const client = new Anthropic()
  const params = {
    model: MODEL,
    max_tokens: Math.min(Number(maxTokens) || 400, 4096),
    system,
    messages,
  }
  // Haiku 4.5 doesn't support the effort parameter (the API rejects it).
  if (!MODEL.startsWith('claude-haiku')) {
    params.output_config = { effort: EFFORT }
  }
  const stream = client.messages.stream(params)
  if (onDelta) stream.on('text', onDelta)
  const response = await stream.finalMessage()
  if (response.stop_reason === 'refusal') {
    return "Hmm, I'd rather steer clear of that one — anything else I can help with?"
  }
  return response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim()
}

// --- backend: headless Claude Code (`claude -p`) -----------------------------
//
// Uses whatever login Claude Code already has (Pro/Max subscription). Each
// reply is one short print-mode run: history is flattened into the prompt,
// persona goes in via --system-prompt, tools are disallowed so it stays a pure
// text completion. A small semaphore stops a chat burst from spawning a pile
// of CLI processes at once.

let running = 0
const waiters = []
const MAX_CONCURRENT = 2

async function withSlot(fn) {
  if (running >= MAX_CONCURRENT) await new Promise((r) => waiters.push(r))
  running++
  try {
    return await fn()
  } finally {
    running--
    waiters.shift()?.()
  }
}

function replyViaClaudeCode({ system, messages }, onDelta) {
  const transcript = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'You'}: ${m.content}`)
    .join('\n')
  const prompt = `${transcript}\n\n(Reply with only your next message — no name prefix.)`
  return withSlot(
    () =>
      new Promise((resolve, reject) => {
        const child = spawn(
          'claude',
          [
            '-p', prompt,
            '--system-prompt', system,
            '--model', CLI_MODEL,
            '--effort', EFFORT,
            '--disallowed-tools', 'Bash', 'Read', 'Write', 'Edit', 'Glob', 'Grep', 'WebFetch', 'WebSearch', 'Task', 'NotebookEdit',
            '--max-turns', '1',
            '--output-format', 'stream-json',
            '--include-partial-messages',
            '--verbose',
          ],
          { cwd: NEUTRAL_CWD },
        )
        const killer = setTimeout(() => child.kill('SIGKILL'), 120_000)
        let buf = ''
        let streamed = ''
        let result = null
        let stderr = ''
        child.stdout.on('data', (chunk) => {
          buf += chunk
          let nl
          while ((nl = buf.indexOf('\n')) >= 0) {
            const line = buf.slice(0, nl)
            buf = buf.slice(nl + 1)
            if (!line.trim()) continue
            try {
              const ev = JSON.parse(line)
              if (
                ev.type === 'stream_event' &&
                ev.event?.type === 'content_block_delta' &&
                ev.event.delta?.type === 'text_delta'
              ) {
                streamed += ev.event.delta.text
                onDelta?.(ev.event.delta.text)
              } else if (ev.type === 'result') {
                result = ev.is_error ? null : String(ev.result ?? '').trim()
              }
            } catch {
              /* ignore non-JSON noise */
            }
          }
        })
        child.stderr.on('data', (c) => (stderr += c))
        child.on('error', (err) => {
          clearTimeout(killer)
          reject(err)
        })
        child.on('close', (code) => {
          clearTimeout(killer)
          const text = (result ?? streamed).trim()
          if (text) resolve(text)
          else reject(new Error(`claude -p failed (code ${code}): ${stderr.slice(0, 300)}`))
        })
      }),
  )
}

// --- http --------------------------------------------------------------------

const reply = BACKEND === 'api' ? replyViaApi : replyViaClaudeCode

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

const server = http.createServer(async (req, res) => {
  if (req.method === 'GET' && req.url === '/api/health') {
    return json(res, 200, {
      ok: true,
      backend: BACKEND,
      model: BACKEND === 'api' ? MODEL : `claude-code (${CLI_MODEL})`,
      effort: EFFORT,
    })
  }
  if (req.method === 'POST' && req.url === '/api/reply') {
    let raw = ''
    req.on('data', (c) => (raw += c))
    req.on('end', async () => {
      try {
        const body = JSON.parse(raw || '{}')
        if (!Array.isArray(body.messages) || !body.messages.length) {
          return json(res, 400, { error: 'messages required' })
        }
        if (body.stream) {
          // Chunked plain-text deltas; the client accumulates them. If the
          // backend produced no deltas, the full text is written at the end.
          res.writeHead(200, {
            'content-type': 'text/plain; charset=utf-8',
            'cache-control': 'no-cache',
            'x-accel-buffering': 'no',
          })
          let sent = 0
          try {
            const full = await reply(body, (delta) => {
              sent += delta.length
              res.write(delta)
            })
            if (full.length > sent) res.write(full.slice(sent))
            res.end()
          } catch (err) {
            console.error('[reply:stream]', err?.message ?? err)
            if (!sent) res.write('(connection hiccup — try again in a moment?)')
            res.end()
          }
          return
        }
        const text = await reply(body)
        json(res, 200, { text: text || '…' })
      } catch (err) {
        console.error('[reply]', err?.status ?? '', err?.message ?? err)
        json(res, err?.status === 429 ? 429 : 502, { error: 'claude request failed' })
      }
    })
    return
  }
  json(res, 404, { error: 'not found' })
})

server.listen(PORT, () => {
  console.log(
    `AI Lounge proxy on http://localhost:${PORT}  (backend: ${BACKEND}, model: ${
      BACKEND === 'api' ? MODEL : `${CLI_MODEL} via your Claude Code login`
    }, effort: ${EFFORT})`,
  )
})
