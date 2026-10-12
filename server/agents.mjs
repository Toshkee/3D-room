// AI Lounge — repo agents.
//
// A bot can be bound to a real git repo on this Mac (lounge.agents.json). When
// you message it, the server runs Claude Code headless IN that repo, on your
// Claude Code login, and streams what it does back to the lounge:
//
//   claude -p "<your message>" --resume <session> --output-format stream-json
//          --model <m> --effort <e> --settings <PreToolUse http hook → here>
//
// Every tool call first hits our PreToolUse HTTP hook. Read-only tools are
// allowed on the spot; anything that changes the repo or runs a command is
// held until you press Allow / Deny in the lounge (the hook request stays open
// meanwhile). `onFailure: "block"` means if this server dies mid-run, the
// pending step is blocked rather than waved through.
//
// Endpoints (all under /api/agents):
//   GET  /api/agents                     → roster with status/session/model
//   GET  /api/agents/events              → Server-Sent Events stream
//   GET  /api/agents/suggest             → git repos under ~ not added yet
//   POST /api/agents                     { path, name?, accent? } → add a repo
//   POST /api/agents/:id/remove          (forget the repo; files untouched)
//   POST /api/agents/:id/message         { text, model?, effort? }
//   POST /api/agents/:id/permission      { requestId, allow }
//   POST /api/agents/:id/stop
//   POST /api/agents/:id/settings        { model?, effort?, autoEdits? }
//   POST /api/agents/:id/reset           (forget the session → fresh context)
//   POST /api/hooks/pretool?agent=&token= (called by Claude Code, not the UI)
import { spawn, execFile } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const CONFIG_FILE = path.join(ROOT, 'lounge.agents.json')
const STATE_FILE = path.join(ROOT, 'server', '.agents-state.json')
const HOOK_TOKEN = crypto.randomBytes(18).toString('hex')
const HOME = process.env.HOME ?? ''

const expandHome = (p) => String(p).replace(/^~(?=$|\/)/, HOME)
const tildify = (p) => (HOME && (p === HOME || p.startsWith(HOME + path.sep)) ? `~${p.slice(HOME.length)}` : p)

const ACCENTS = ['#ff7a45', '#6d5efc', '#2aa7ff', '#14b8a6', '#22c55e', '#f5a524', '#ff5fa2', '#a35bff']
const MODELS = new Set(['haiku', 'sonnet', 'opus', 'fable'])
const EFFORTS = new Set(['low', 'medium', 'high', 'xhigh', 'max'])
// Tools that only look — allowed without asking.
const READ_ONLY = new Set([
  'Read', 'Glob', 'Grep', 'LS', 'NotebookRead', 'TodoWrite', 'ToolSearch',
  'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet', 'TaskOutput', 'Agent', 'Task',
])
const EDIT_TOOLS = new Set(['Edit', 'Write', 'MultiEdit', 'NotebookEdit'])

// --- read-only shell commands (auto-allowed) ----------------------------------
// Agents often look around with `ls`, `cat`, `git status`… Asking for each of
// those would bury the real questions, so a deliberately conservative check
// lets a command through only when every piece of it is a plain reader. When
// in doubt it says no, and the user gets asked as usual.
const SHELL_READERS = new Set([
  'ls', 'cat', 'head', 'tail', 'wc', 'pwd', 'echo', 'printf', 'find', 'grep', 'egrep', 'rg',
  'cut', 'tr', 'file', 'stat', 'du', 'tree', 'which', 'basename', 'dirname', 'realpath',
  'diff', 'nl', 'jq', 'sed', 'sort', 'cd', 'true',
])
const GIT_READERS = new Set(['status', 'log', 'diff', 'show', 'ls-files', 'rev-parse', 'blame', 'shortlog', 'describe', 'branch', 'remote'])

// Split a command on unquoted &&, ||, |, ; — pipes inside "a|b" stay put.
function shellSegments(cmd) {
  const out = []
  let cur = ''
  let q = ''
  for (let i = 0; i < cmd.length; i++) {
    const c = cmd[i]
    if (q) {
      if (c === q) q = ''
      else if (c === '\\' && q === '"') cur += c + (cmd[++i] ?? '')
      cur += c === '\\' && q === '"' ? '' : c
      continue
    }
    if (c === '"' || c === "'") {
      q = c
      cur += c
    } else if (c === ';' || c === '|' || (c === '&' && cmd[i + 1] === '&')) {
      if ((c === '|' || c === '&') && cmd[i + 1] === c) i++
      out.push(cur)
      cur = ''
    } else if (c === '&') {
      return null // backgrounding
    } else cur += c
  }
  if (q) return null // unbalanced quotes
  out.push(cur)
  return out
}

function shellWords(segment) {
  return (segment.match(/"(?:[^"\\]|\\.)*"|'[^']*'|\S+/g) ?? []).map((w) => w.replace(/^["']|["']$/g, ''))
}

export function isReadOnlyShell(command) {
  let cmd = String(command ?? '')
  // Harmless redirections of noise.
  cmd = cmd.replace(/\s[12]?>\s?\/dev\/null/g, ' ').replace(/\s2>&1/g, ' ')
  // Anything that could write or run a nested command, quoted or not.
  if (/[>`]|\$\(|<\(|\n/.test(cmd)) return false
  const segments = shellSegments(cmd)
  if (!segments) return false
  for (const raw of segments) {
    const words = shellWords(raw.trim())
    if (!words.length) return false
    const [bin, ...rest] = words
    if (/=/.test(bin)) return false // VAR=… prefixes
    if (bin === 'git') {
      const args = rest[0] === '-C' ? rest.slice(2) : rest
      const sub = args[0]
      if (!GIT_READERS.has(sub)) return false
      if (sub === 'branch' && args.slice(1).some((x) => !/^(-a|-r|-v|-vv|--list|--all|--show-current)$/.test(x))) return false
      if (sub === 'remote' && args.slice(1).some((x) => x !== '-v')) return false
      if (args.some((x) => /^--output/.test(x))) return false
      continue
    }
    if (!SHELL_READERS.has(bin)) return false
    const line = rest.join(' ')
    if (bin === 'find' && /-(exec|execdir|ok|okdir|delete|fprint|fprint0|fprintf|fls)\b/.test(line)) return false
    if (bin === 'sed' && !(rest[0] === '-n' && rest.slice(1, -1).every((x) => /^\d+(,\d+)?p$/.test(x)))) return false
    if ((bin === 'sort' || bin === 'tree') && /(^|\s)-o\b/.test(line)) return false
    if (bin === 'rg' && /--pre\b/.test(line)) return false
  }
  return true
}
const PERMISSION_WAIT_MS = 570_000 // answer before Claude Code's 600 s hook timeout

const SYSTEM_NOTE = [
  'You are running headless inside AI Lounge, a dashboard the user watches.',
  'Every tool call you make shows up live in the lounge. Read-only tools run freely;',
  'file edits and shell commands wait for the user to press Allow or Deny there.',
  'Prefer the Read, Glob and Grep tools for looking around; they never need approval.',
  'If a step is denied, do not retry it — say what you needed and why.',
  'Do not commit or push unless the user asks.',
  'Finish with a short plain summary: what you did and which files changed.',
].join(' ')

// --- config + persisted state ----------------------------------------------

function readJson(file, fallback) {
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

const saved = readJson(STATE_FILE, {})
const agents = new Map()

function makeAgent(entry, dir) {
  const s = saved[entry.id] ?? {}
  return {
    id: entry.id,
    name: entry.name ?? path.basename(dir),
    accent: /^#[0-9a-f]{6}$/i.test(entry.accent ?? '') ? entry.accent : ACCENTS[agents.size % ACCENTS.length],
    blurb: entry.blurb ?? '',
    path: dir,
    model: MODELS.has(s.model) ? s.model : MODELS.has(entry.model) ? entry.model : 'sonnet',
    effort: EFFORTS.has(s.effort) ? s.effort : EFFORTS.has(entry.effort) ? entry.effort : 'medium',
    autoEdits: Boolean(s.autoEdits ?? entry.autoEdits ?? false),
    sessionId: s.sessionId ?? null,
    status: 'idle',
    child: null,
    starting: false,
    run: null,
    pending: new Map(),
    lastRun: s.lastRun ?? null,
  }
}

function loadConfig() {
  const cfg = readJson(CONFIG_FILE, { agents: [] })
  for (const entry of cfg.agents ?? []) {
    if (!entry?.id || !entry?.path) continue
    const dir = path.resolve(expandHome(entry.path))
    if (!fs.existsSync(dir)) {
      console.warn(`[agents] skipping ${entry.id}: ${dir} does not exist`)
      continue
    }
    agents.set(entry.id, makeAgent(entry, dir))
  }
}

/** Rewrites lounge.agents.json through `edit`, keeping entries we didn't load. */
function editConfig(edit) {
  const cfg = readJson(CONFIG_FILE, { agents: [] })
  cfg.agents = edit(Array.isArray(cfg.agents) ? cfg.agents : [])
  fs.writeFileSync(CONFIG_FILE, `${JSON.stringify(cfg, null, 2)}\n`)
}

const slug = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 24)

/** Adds a repo from the lounge's "Add repo" dialog. Returns { status, body }. */
function addAgent(body) {
  const raw = String(body.path ?? '').trim()
  if (!raw) return { status: 400, body: { error: 'Choose a folder.' } }
  if (!raw.startsWith('/') && !raw.startsWith('~')) {
    return { status: 400, body: { error: 'Use the full path, like ~/Projects/my-app.' } }
  }
  let dir
  try {
    dir = fs.realpathSync(path.resolve(expandHome(raw)))
  } catch {
    return { status: 404, body: { error: `There's no folder at ${raw}.` } }
  }
  if (!fs.statSync(dir).isDirectory()) return { status: 400, body: { error: 'That is a file, not a folder.' } }
  if (dir === HOME || dir === path.parse(dir).root) {
    return { status: 400, body: { error: 'Pick a project folder, not your whole home folder.' } }
  }
  const dup = [...agents.values()].find((a) => a.path === dir)
  if (dup) return { status: 409, body: { error: `That repo is already in the lounge as ${dup.name}.` } }

  const name = (String(body.name ?? '').trim() || path.basename(dir)).slice(0, 24)
  const base = slug(name) || 'repo'
  let id = base
  for (let n = 2; agents.has(id); n++) id = `${base}-${n}`
  const used = new Set([...agents.values()].map((a) => a.accent))
  const accent = /^#[0-9a-f]{6}$/i.test(body.accent ?? '')
    ? body.accent
    : ACCENTS.find((c) => !used.has(c)) ?? ACCENTS[agents.size % ACCENTS.length]
  const entry = { id, name, path: tildify(dir), accent, model: 'sonnet', effort: 'medium', autoEdits: false }
  try {
    editConfig((list) => [...list, entry])
  } catch (err) {
    return { status: 500, body: { error: `Couldn't save lounge.agents.json: ${err?.message}` } }
  }
  const a = makeAgent(entry, dir)
  agents.set(id, a)
  send({ type: 'agent', agent: publicAgent(a) })
  return { status: 201, body: { agent: publicAgent(a) } }
}

// Folders the scan skips: noise, plus the ones macOS guards with a privacy
// prompt (Desktop, Documents, Downloads…) — opening a dialog shouldn't trigger
// one. Repos there can still be added by typing the path.
const SCAN_SKIP = new Set([
  'Library', 'Applications', 'Desktop', 'Documents', 'Downloads', 'Pictures', 'Music', 'Movies',
  'Public', 'node_modules',
])

/** Git repos up to two levels under ~, most recently touched first. */
function suggestRepos() {
  const taken = new Set([...agents.values()].map((a) => a.path))
  const found = []
  const visit = (dir, depth) => {
    let entries
    try {
      entries = fs.readdirSync(dir, { withFileTypes: true })
    } catch {
      return
    }
    for (const e of entries) {
      if (!e.isDirectory() || e.name.startsWith('.') || (depth === 1 && SCAN_SKIP.has(e.name))) continue
      if (e.name === 'node_modules') continue
      const full = path.join(dir, e.name)
      let gitStat = null
      try {
        gitStat = fs.statSync(path.join(full, '.git'))
      } catch {
        /* not a repo */
      }
      if (gitStat) {
        if (!taken.has(full)) found.push({ full, at: gitStat.mtimeMs })
      } else if (depth < 2) visit(full, depth + 1)
    }
  }
  if (HOME) visit(HOME, 1)
  return found
    .sort((x, y) => y.at - x.at)
    .slice(0, 12)
    .map(({ full }) => ({ path: tildify(full), name: path.basename(full) }))
}

function persist() {
  const out = {}
  for (const a of agents.values()) {
    out[a.id] = {
      sessionId: a.sessionId,
      model: a.model,
      effort: a.effort,
      autoEdits: a.autoEdits,
      lastRun: a.lastRun,
    }
  }
  try {
    fs.writeFileSync(STATE_FILE, JSON.stringify(out, null, 2))
  } catch (err) {
    console.warn('[agents] could not save state', err?.message)
  }
}

loadConfig()

// --- server-sent events ------------------------------------------------------

const clients = new Set()

function send(event) {
  const data = `data: ${JSON.stringify(event)}\n\n`
  for (const res of clients) res.write(data)
}

function publicAgent(a) {
  return {
    id: a.id,
    name: a.name,
    accent: a.accent,
    blurb: a.blurb,
    repo: path.basename(a.path),
    path: tildify(a.path),
    model: a.model,
    effort: a.effort,
    autoEdits: a.autoEdits,
    status: a.status,
    sessionId: a.sessionId,
    busy: Boolean(a.child || a.starting),
    lastRun: a.lastRun,
    pending: [...a.pending.values()].map((p) => p.request),
  }
}

function setStatus(a, status) {
  if (a.status === status) return
  a.status = status
  send({ type: 'status', agentId: a.id, status })
}

// --- describing tool calls for humans -----------------------------------------

function rel(a, file) {
  if (!file) return ''
  const f = String(file)
  return f.startsWith(a.path + path.sep) ? f.slice(a.path.length + 1) : f
}
const clip = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s))

function describe(a, name, input = {}) {
  switch (name) {
    case 'Read':
      return { text: `Read ${rel(a, input.file_path)}`, kind: 'info' }
    case 'Glob':
      return { text: `Find files ${clip(input.pattern ?? '', 60)}`, kind: 'info' }
    case 'Grep':
      return { text: `Search "${clip(input.pattern ?? '', 50)}"${input.path ? ` in ${rel(a, input.path)}` : ''}`, kind: 'info' }
    case 'Edit':
    case 'MultiEdit':
      return { text: `Edit ${rel(a, input.file_path)}`, kind: 'action' }
    case 'Write':
      return { text: `Write ${rel(a, input.file_path)}`, kind: 'action' }
    case 'NotebookEdit':
      return { text: `Edit notebook ${rel(a, input.notebook_path)}`, kind: 'action' }
    case 'Bash':
      return { text: `$ ${clip(input.command ?? '', 90)}`, kind: 'action' }
    case 'WebFetch':
      return { text: `Fetch ${clip(input.url ?? '', 70)}`, kind: 'info' }
    case 'WebSearch':
      return { text: `Web search "${clip(input.query ?? '', 60)}"`, kind: 'info' }
    case 'Agent':
    case 'Task':
      return { text: `Subagent: ${clip(input.description ?? input.prompt ?? '', 70)}`, kind: 'thought' }
    case 'TodoWrite':
      return { text: 'Updated its to-do list', kind: 'thought' }
    default:
      return { text: name, kind: 'info' }
  }
}

/** What the lounge shows on the Allow / Deny card. */
function permissionRequest(a, payload) {
  const name = payload.tool_name
  const input = payload.tool_input ?? {}
  let summary = name
  let detail = ''
  if (name === 'Bash') {
    summary = 'Run a shell command'
    detail = String(input.command ?? '')
  } else if (EDIT_TOOLS.has(name)) {
    summary = `${name === 'Write' ? 'Create or overwrite' : 'Edit'} ${rel(a, input.file_path ?? input.notebook_path)}`
    if (name === 'Write') detail = clip(input.content ?? '', 1200)
    else if (name === 'Edit') detail = `- ${clip(input.old_string ?? '', 500)}\n+ ${clip(input.new_string ?? '', 500)}`
    else if (name === 'MultiEdit') detail = `${(input.edits ?? []).length} edits`
  } else if (name === 'WebFetch') {
    summary = 'Fetch a web page'
    detail = String(input.url ?? '')
  } else if (name === 'WebSearch') {
    summary = 'Search the web'
    detail = String(input.query ?? '')
  } else {
    summary = `Use ${name}`
    detail = clip(JSON.stringify(input), 600)
  }
  return {
    requestId: crypto.randomUUID(),
    agentId: a.id,
    tool: name,
    summary,
    detail,
    at: Date.now(),
  }
}

// --- the PreToolUse hook (called by Claude Code) --------------------------------

function decision(allow, reason) {
  return {
    hookSpecificOutput: {
      hookEventName: 'PreToolUse',
      permissionDecision: allow ? 'allow' : 'deny',
      permissionDecisionReason: reason,
    },
  }
}

function onPreToolUse(a, payload) {
  const name = payload.tool_name
  if (READ_ONLY.has(name)) return Promise.resolve(decision(true, 'read-only'))
  if (name === 'AskUserQuestion' || name === 'ExitPlanMode') {
    return Promise.resolve(
      decision(false, 'There is no interactive prompt here — ask your question in your final message instead.'),
    )
  }
  if (a.autoEdits && EDIT_TOOLS.has(name)) return Promise.resolve(decision(true, 'auto-approved edit'))
  if (name === 'Bash' && isReadOnlyShell(payload.tool_input?.command)) {
    return Promise.resolve(decision(true, 'read-only shell command'))
  }
  // Hold the step until the user answers in the lounge.
  const request = permissionRequest(a, payload)
  return new Promise((resolve) => {
    const timer = setTimeout(() => answer(a, request.requestId, false, 'No answer in time.'), PERMISSION_WAIT_MS)
    a.pending.set(request.requestId, { request, resolve, timer })
    setStatus(a, 'waiting')
    send({ type: 'permission', agentId: a.id, request })
  })
}

function answer(a, requestId, allow, why) {
  const p = a.pending.get(requestId)
  if (!p) return false
  clearTimeout(p.timer)
  a.pending.delete(requestId)
  p.resolve(decision(allow, allow ? 'Approved in AI Lounge.' : why ?? 'The user denied this step in AI Lounge.'))
  send({ type: 'permission-resolved', agentId: a.id, requestId, allow })
  if (a.child && !a.pending.size) setStatus(a, 'working')
  return true
}

// --- running Claude Code in the repo --------------------------------------------

function git(dir, args) {
  return new Promise((resolve) => {
    execFile('git', ['-C', dir, ...args], { maxBuffer: 8 * 1024 * 1024 }, (err, stdout) =>
      resolve(err ? '' : stdout),
    )
  })
}

// --- what a run changed ----------------------------------------------------------
// Before each run, `git stash create` records the working tree as a commit
// without touching it (no stash entry, no checkout; HEAD when the tree is
// clean). After the run, `git diff <that>` is exactly what the run did to
// tracked files: your own uncommitted work isn't counted, and changes the agent
// commits (when asked) still show. Untracked files are compared by mtime.

async function treeBase(dir) {
  const stash = (await git(dir, ['stash', 'create'])).trim()
  return stash || (await git(dir, ['rev-parse', 'HEAD'])).trim() || null
}

async function untrackedFiles(dir) {
  const out = await git(dir, ['ls-files', '--others', '--exclude-standard', '-z'])
  const files = new Map()
  for (const file of out.split('\0').filter(Boolean).slice(0, 2000)) {
    try {
      files.set(file, fs.statSync(path.join(dir, file)).mtimeMs)
    } catch {
      /* gone already */
    }
  }
  return files
}

/** A new file's text for the diff view (skips big and binary files). */
function newFileText(dir, file) {
  try {
    const full = path.join(dir, file)
    if (fs.statSync(full).size > 200_000) return null
    const text = fs.readFileSync(full, 'utf8')
    return text.includes('\0') ? null : text
  } catch {
    return null
  }
}

async function runChanges(dir, base, untrackedBefore) {
  const files = []
  const parts = []
  if (base) {
    const [diff, numstat] = await Promise.all([
      git(dir, ['diff', base, '--no-color', '--no-ext-diff']),
      git(dir, ['diff', base, '--numstat']),
    ])
    const stats = new Map()
    for (const line of numstat.split('\n')) {
      const [add, del, file] = line.split('\t')
      if (file) stats.set(file, { add: add === '-' ? null : Number(add), del: del === '-' ? null : Number(del) })
    }
    for (const chunk of diff.split(/^(?=diff --git )/m)) {
      const m = chunk.slice(0, chunk.indexOf('\n')).match(/^diff --git a\/.+ b\/(.+)$/)
      if (!m) continue
      const kind = /^new file mode/m.test(chunk) ? 'new' : /^deleted file mode/m.test(chunk) ? 'deleted' : 'edit'
      files.push({ path: m[1], kind, ...(stats.get(m[1]) ?? { add: null, del: null }) })
      parts.push(chunk)
    }
  }
  for (const [file, mtime] of await untrackedFiles(dir)) {
    if (untrackedBefore.get(file) === mtime) continue
    const text = newFileText(dir, file)
    const lines = text == null ? null : text.split('\n').length - (text.endsWith('\n') ? 1 : 0)
    files.push({ path: file, kind: untrackedBefore.has(file) ? 'edit' : 'new', add: lines, del: null })
    parts.push(
      text == null
        ? `new file ${file} (binary or large, not shown)\n`
        : `new file ${file}\n${text.replace(/\n$/, '').split('\n').map((l) => `+${l}`).join('\n')}\n`,
    )
  }
  const diff = parts.join('\n')
  return { files, diff: diff.length > 40_000 ? `${diff.slice(0, 40_000)}\n… (diff truncated)` : diff }
}

let runSeq = 0

async function startRun(a, text) {
  const runId = `${a.id}-${Date.now().toString(36)}-${++runSeq}`
  a.starting = true
  const [base, untrackedBefore] = await Promise.all([treeBase(a.path), untrackedFiles(a.path)])
  const port = Number(process.env.PORT || 8787)
  const settings = {
    hooks: {
      PreToolUse: [
        {
          matcher: '*',
          hooks: [
            {
              type: 'http',
              url: `http://127.0.0.1:${port}/api/hooks/pretool?agent=${encodeURIComponent(a.id)}&token=${HOOK_TOKEN}`,
              timeout: 600,
              onFailure: 'block',
            },
          ],
        },
      ],
    },
  }
  const args = [
    '-p', text,
    '--output-format', 'stream-json',
    '--verbose',
    '--include-partial-messages',
    '--model', a.model,
    '--effort', a.effort,
    '--permission-mode', 'default',
    '--settings', JSON.stringify(settings),
    '--append-system-prompt', SYSTEM_NOTE,
  ]
  if (a.sessionId) args.push('--resume', a.sessionId)

  // stdin closed: otherwise `claude -p` waits 3 s for piped input first.
  const child = spawn('claude', args, { cwd: a.path, env: process.env, stdio: ['ignore', 'pipe', 'pipe'] })
  a.stopping = false
  a.starting = false
  a.child = child
  a.run = { id: runId, text: '', tools: 0, started: Date.now(), prompt: text }
  setStatus(a, 'working')
  send({ type: 'run-start', agentId: a.id, runId, prompt: text, model: a.model, effort: a.effort })
  send({ type: 'reply', agentId: a.id, id: runId, text: '' })

  let buf = ''
  let stderr = ''
  let result = null
  const toolNames = new Map()

  const onEvent = (ev) => {
    if (ev.type === 'system' && ev.subtype === 'init' && ev.session_id) {
      if (a.sessionId !== ev.session_id) {
        a.sessionId = ev.session_id
        persist()
      }
    } else if (
      ev.type === 'stream_event' &&
      ev.event?.type === 'content_block_delta' &&
      ev.event.delta?.type === 'text_delta'
    ) {
      a.run.text += ev.event.delta.text
      send({ type: 'reply', agentId: a.id, id: runId, text: a.run.text })
    } else if (ev.type === 'assistant') {
      for (const block of ev.message?.content ?? []) {
        if (block.type !== 'tool_use') continue
        // Narration before a tool call goes to the feed; the chat keeps only
        // the final answer.
        const narration = a.run.text.trim()
        if (narration) {
          send({ type: 'activity', agentId: a.id, text: clip(narration.replace(/\s+/g, ' '), 220), kind: 'thought' })
          a.run.text = ''
          send({ type: 'reply', agentId: a.id, id: runId, text: '' })
        }
        a.run.tools += 1
        toolNames.set(block.id, describe(a, block.name, block.input))
        const d = toolNames.get(block.id)
        send({ type: 'activity', agentId: a.id, text: d.text, kind: d.kind })
      }
    } else if (ev.type === 'user') {
      const content = ev.message?.content
      if (!Array.isArray(content)) return
      for (const block of content) {
        if (block.type !== 'tool_result' || !block.is_error) continue
        const d = toolNames.get(block.tool_use_id)
        const msg = typeof block.content === 'string' ? block.content : JSON.stringify(block.content ?? '')
        const denied = /denied|hook error/i.test(msg)
        send({
          type: 'activity',
          agentId: a.id,
          text: `${denied ? 'Denied' : 'Failed'}: ${d?.text ?? 'tool call'}`,
          kind: 'thought',
        })
      }
    } else if (ev.type === 'result') {
      result = ev
    }
  }

  child.stdout.on('data', (chunk) => {
    buf += chunk
    let nl
    while ((nl = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, nl)
      buf = buf.slice(nl + 1)
      if (!line.trim()) continue
      try {
        onEvent(JSON.parse(line))
      } catch {
        /* non-JSON noise */
      }
    }
  })
  child.stderr.on('data', (c) => (stderr += c))

  child.on('error', (err) => finish(err.message))
  child.on('close', (code) =>
    finish(code === 0 ? null : a.stopping ? 'Stopped.' : `Claude Code exited with ${code}: ${clip(stderr.trim(), 300)}`),
  )

  let finished = false
  async function finish(errorText) {
    if (finished) return
    finished = true
    for (const id of [...a.pending.keys()]) answer(a, id, false, 'The run ended.')
    a.child = null
    const { files, diff } = await runChanges(a.path, base, untrackedBefore)
    const finalText = String(result?.result ?? a.run.text ?? '').trim()
    const ok = !errorText && result && !result.is_error
    a.lastRun = {
      runId,
      ok: Boolean(ok),
      turns: result?.num_turns ?? null,
      durationMs: result?.duration_ms ?? Date.now() - a.run.started,
      costUsd: result?.total_cost_usd ?? null,
      tools: a.run.tools,
      denied: (result?.permission_denials ?? []).length,
      files: files.length,
      prompt: clip(a.run.prompt, 140),
      at: Date.now(),
    }
    persist()
    if (finalText) send({ type: 'reply', agentId: a.id, id: runId, text: finalText })
    send({
      type: 'result',
      agentId: a.id,
      runId,
      ok: Boolean(ok),
      error: ok ? null : errorText ?? result?.subtype ?? 'unknown error',
      prompt: a.run.prompt,
      text: finalText,
      lastRun: a.lastRun,
      files,
      diff,
    })
    a.run = null
    setStatus(a, ok ? 'done' : 'idle')
    if (ok) setTimeout(() => !a.child && setStatus(a, 'idle'), 9000)
  }
}

// --- http routes -----------------------------------------------------------------

function readBody(req) {
  return new Promise((resolve) => {
    let raw = ''
    req.on('data', (c) => {
      raw += c
      if (raw.length > 1_000_000) req.destroy()
    })
    req.on('end', () => {
      try {
        resolve(JSON.parse(raw || '{}'))
      } catch {
        resolve(null)
      }
    })
  })
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' })
  res.end(JSON.stringify(body))
}

/** Returns true if it handled the request. */
export async function handleAgents(req, res, url) {
  const { pathname } = url

  if (pathname === '/api/hooks/pretool' && req.method === 'POST') {
    const a = agents.get(url.searchParams.get('agent') ?? '')
    if (!a || url.searchParams.get('token') !== HOOK_TOKEN) return json(res, 403, { error: 'forbidden' }), true
    const payload = await readBody(req)
    if (!payload) return json(res, 400, { error: 'bad json' }), true
    json(res, 200, await onPreToolUse(a, payload))
    return true
  }

  if (!pathname.startsWith('/api/agents')) return false

  if (pathname === '/api/agents' && req.method === 'GET') {
    json(res, 200, { agents: [...agents.values()].map(publicAgent) })
    return true
  }

  if (pathname === '/api/agents' && req.method === 'POST') {
    const body = await readBody(req)
    if (!body) return json(res, 400, { error: 'bad json' }), true
    const out = addAgent(body)
    json(res, out.status, out.body)
    return true
  }

  if (pathname === '/api/agents/suggest' && req.method === 'GET') {
    json(res, 200, { repos: suggestRepos() })
    return true
  }

  if (pathname === '/api/agents/events' && req.method === 'GET') {
    res.writeHead(200, {
      'content-type': 'text/event-stream',
      'cache-control': 'no-cache',
      connection: 'keep-alive',
      'x-accel-buffering': 'no',
    })
    res.write(`data: ${JSON.stringify({ type: 'snapshot', agents: [...agents.values()].map(publicAgent) })}\n\n`)
    clients.add(res)
    // A data heartbeat: the browser treats silence as "server gone" (a dev proxy
    // can keep the stream open after this process dies).
    const ping = setInterval(() => res.write(`data: {"type":"ping"}\n\n`), 5_000)
    req.on('close', () => {
      clearInterval(ping)
      clients.delete(res)
    })
    return true
  }

  const m = pathname.match(/^\/api\/agents\/([\w-]+)\/(message|permission|stop|settings|reset|remove)$/)
  if (!m || req.method !== 'POST') return json(res, 404, { error: 'not found' }), true
  const a = agents.get(m[1])
  if (!a) return json(res, 404, { error: 'unknown agent' }), true
  const body = await readBody(req)
  if (!body) return json(res, 400, { error: 'bad json' }), true

  switch (m[2]) {
    case 'message': {
      const text = String(body.text ?? '').trim()
      if (!text) return json(res, 400, { error: 'text required' }), true
      if (a.child || a.starting) return json(res, 409, { error: `${a.name} is still working on the last message.` }), true
      if (MODELS.has(body.model)) a.model = body.model
      if (EFFORTS.has(body.effort)) a.effort = body.effort
      persist()
      startRun(a, text)
      json(res, 202, { ok: true })
      return true
    }
    case 'permission': {
      const ok = answer(a, String(body.requestId ?? ''), Boolean(body.allow))
      json(res, ok ? 200 : 404, { ok })
      return true
    }
    case 'stop': {
      for (const id of [...a.pending.keys()]) answer(a, id, false, 'The user stopped the run.')
      if (a.child) {
        a.stopping = true
        a.child.kill('SIGTERM')
      }
      json(res, 200, { ok: true })
      return true
    }
    case 'settings': {
      if (MODELS.has(body.model)) a.model = body.model
      if (EFFORTS.has(body.effort)) a.effort = body.effort
      if (typeof body.autoEdits === 'boolean') a.autoEdits = body.autoEdits
      persist()
      send({ type: 'agent', agent: publicAgent(a) })
      json(res, 200, publicAgent(a))
      return true
    }
    case 'reset': {
      if (a.child || a.starting) return json(res, 409, { error: 'busy' }), true
      a.sessionId = null
      persist()
      send({ type: 'agent', agent: publicAgent(a) })
      json(res, 200, { ok: true })
      return true
    }
    case 'remove': {
      if (a.child || a.starting) return json(res, 409, { error: `Stop ${a.name} first.` }), true
      try {
        editConfig((list) => list.filter((e) => e?.id !== a.id))
      } catch (err) {
        return json(res, 500, { error: `Couldn't save lounge.agents.json: ${err?.message}` }), true
      }
      agents.delete(a.id)
      persist()
      send({ type: 'removed', agentId: a.id })
      json(res, 200, { ok: true })
      return true
    }
  }
  return false
}

export function agentCount() {
  return agents.size
}

export function stopAllAgents() {
  for (const a of agents.values()) a.child?.kill('SIGTERM')
}
