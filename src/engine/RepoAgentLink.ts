import type {
  ActivityLine,
  AgentRun,
  Change,
  ChangedFile,
  Connection,
  Message,
  PermissionRequest,
  Status,
} from '../types'

// ---------------------------------------------------------------------------
// The browser side of repo agents (server/agents.mjs). Every bot in the lounge
// is a repo with a real Claude Code session behind it, and everything it shows
// comes from those runs, pushed over Server-Sent Events: tool calls become
// activity lines, the final answer streams into its chat, a permission request
// turns it into "Needs you", and the files a run changed arrive as a Change.
// Messages, answers and settings go back over plain JSON POSTs.
// ---------------------------------------------------------------------------

export interface AgentInfo {
  id: string
  name: string
  accent: string
  blurb: string
  repo: string
  path: string
  model: string
  effort: string
  autoEdits: boolean
  status: Status
  sessionId: string | null
  busy: boolean
  lastRun: AgentRun | null
  pending: PermissionRequest[]
}

export interface RepoSuggestion {
  path: string
  name: string
}

export interface LinkHandlers {
  onConnection(state: Connection): void
  /** The whole roster (`full`, on connect) or just the agents that changed. */
  onRoster(agents: AgentInfo[], full: boolean): void
  onRemoved(botId: string): void
  onStatus(botId: string, patch: { status?: Status; task?: string }): void
  onActivity(line: ActivityLine): void
  /** Upsert by message id — a streaming reply re-sends the same id as it grows. */
  onChat(botId: string, message: Message): void
  onChanges(change: Change): void
  onPermission(botId: string, pending: PermissionRequest[]): void
  onRun(botId: string, run: AgentRun): void
}

export const MODELS = ['haiku', 'sonnet', 'opus', 'fable'] as const
export const EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const

export const agentBotId = (agentId: string) => `repo-${agentId}`
const agentIdOf = (botId: string) => botId.replace(/^repo-/, '')

const OFFLINE = 'The lounge server is not running. Start it with `npm run server`.'
const RETRY_MS = 3000
/** The server pings every 5 s; this long without a word means it's gone. */
const SILENCE_MS = 15_000

let seq = 0
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${++seq}`
const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

type ServerEvent =
  | { type: 'ping' }
  | { type: 'snapshot'; agents: AgentInfo[] }
  | { type: 'agent'; agent: AgentInfo }
  | { type: 'removed'; agentId: string }
  | { type: 'status'; agentId: string; status: Status }
  | { type: 'run-start'; agentId: string; runId: string; prompt: string }
  | { type: 'reply'; agentId: string; id: string; text: string }
  | { type: 'activity'; agentId: string; text: string; kind: ActivityLine['kind'] }
  | { type: 'permission'; agentId: string; request: PermissionRequest }
  | { type: 'permission-resolved'; agentId: string; requestId: string; allow: boolean }
  | {
      type: 'result'
      agentId: string
      runId: string
      ok: boolean
      error: string | null
      prompt: string
      text: string
      lastRun: AgentRun
      files: ChangedFile[]
      diff: string
    }

export class RepoAgentLink {
  private h: LinkHandlers
  private es: EventSource | null = null
  private retry: ReturnType<typeof setTimeout> | null = null
  private watchdog: ReturnType<typeof setInterval> | null = null
  private lastHeard = 0
  private live = false
  private pending = new Map<string, PermissionRequest[]>()
  private replyAt = new Map<string, number>()

  constructor(handlers: LinkHandlers) {
    this.h = handlers
  }

  /** Open the event stream. While the server is down it keeps retrying. */
  start() {
    this.live = true
    this.connect()
    // A dev proxy can keep the stream open after the server dies, so silence
    // (no heartbeat) counts as a drop too.
    this.watchdog = setInterval(() => {
      if (this.es?.readyState === EventSource.OPEN && Date.now() - this.lastHeard > SILENCE_MS) this.drop()
    }, 5000)
  }

  stop() {
    this.live = false
    if (this.retry) clearTimeout(this.retry)
    if (this.watchdog) clearInterval(this.watchdog)
    this.retry = null
    this.watchdog = null
    this.es?.close()
    this.es = null
  }

  private connect() {
    if (!this.live) return
    this.es?.close()
    const es = new EventSource('/api/agents/events')
    this.es = es
    this.lastHeard = Date.now()
    es.onmessage = (m) => {
      this.lastHeard = Date.now()
      try {
        this.onEvent(JSON.parse(m.data) as ServerEvent)
      } catch {
        /* ignore malformed */
      }
    }
    es.onerror = () => {
      this.h.onConnection('offline')
      // A refused connection (the dev proxy answers 5xx) closes for good;
      // a dropped one retries by itself.
      if (es.readyState === EventSource.CLOSED && this.es === es) this.drop()
    }
  }

  /** Mark offline, close, and try again shortly. */
  private drop() {
    this.h.onConnection('offline')
    this.es?.close()
    this.es = null
    if (!this.live) return
    if (this.retry) clearTimeout(this.retry)
    this.retry = setTimeout(() => this.connect(), RETRY_MS)
  }

  async send(botId: string, text: string, opts: { model?: string; effort?: string } = {}): Promise<string | null> {
    return this.post(botId, 'message', { text, ...opts })
  }

  answer(botId: string, requestId: string, allow: boolean) {
    // Optimistic: drop the card right away; the server confirms over SSE.
    const list = (this.pending.get(botId) ?? []).filter((r) => r.requestId !== requestId)
    this.pending.set(botId, list)
    this.h.onPermission(botId, list)
    void this.post(botId, 'permission', { requestId, allow })
  }

  stopRun(botId: string) {
    void this.post(botId, 'stop', {})
  }

  settings(botId: string, patch: { model?: string; effort?: string; autoEdits?: boolean }) {
    void this.post(botId, 'settings', patch)
  }

  reset(botId: string): Promise<string | null> {
    return this.post(botId, 'reset', {})
  }

  remove(botId: string): Promise<string | null> {
    return this.post(botId, 'remove', {})
  }

  /** Adds a repo. Resolves to the new bot's id, or an error message. */
  async add(input: { path: string; name?: string; accent?: string }): Promise<{ botId: string } | { error: string }> {
    try {
      const res = await fetch('/api/agents', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(input),
      })
      const body = (await res.json().catch(() => null)) as { agent?: AgentInfo; error?: string } | null
      if (res.ok && body?.agent) return { botId: agentBotId(body.agent.id) }
      return { error: body?.error ?? (res.status >= 500 ? OFFLINE : `Request failed (${res.status}).`) }
    } catch {
      return { error: OFFLINE }
    }
  }

  /** Git repos under ~ that aren't in the lounge yet (empty if unreachable). */
  async suggest(): Promise<RepoSuggestion[]> {
    try {
      const res = await fetch('/api/agents/suggest')
      if (!res.ok) return []
      return ((await res.json()) as { repos?: RepoSuggestion[] }).repos ?? []
    } catch {
      return []
    }
  }

  /** Returns an error message, or null on success. */
  private async post(botId: string, action: string, body: object): Promise<string | null> {
    try {
      const res = await fetch(`/api/agents/${encodeURIComponent(agentIdOf(botId))}/${action}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(body),
      })
      if (res.ok) return null
      const err = (await res.json().catch(() => null)) as { error?: string } | null
      return err?.error ?? (res.status >= 500 ? OFFLINE : `Request failed (${res.status}).`)
    } catch {
      return OFFLINE
    }
  }

  private applyRoster(agents: AgentInfo[], full: boolean) {
    this.h.onRoster(agents, full)
    for (const a of agents) {
      const botId = agentBotId(a.id)
      this.pending.set(botId, a.pending ?? [])
      this.h.onPermission(botId, a.pending ?? [])
      if (a.lastRun) this.h.onRun(botId, a.lastRun)
    }
  }

  private onEvent(e: ServerEvent) {
    switch (e.type) {
      case 'ping':
        return
      case 'snapshot':
        this.h.onConnection('online')
        this.applyRoster(e.agents, true)
        return
      case 'agent':
        this.applyRoster([e.agent], false)
        return
    }
    const botId = agentBotId(e.agentId)
    const now = Date.now()
    switch (e.type) {
      case 'removed':
        this.pending.delete(botId)
        this.h.onRemoved(botId)
        break
      case 'status':
        this.h.onStatus(botId, { status: e.status })
        break
      case 'run-start':
        this.h.onStatus(botId, { status: 'working', task: clip(e.prompt, 70) })
        this.h.onActivity({ id: uid('act'), botId, text: `Started: ${clip(e.prompt, 90)}`, kind: 'info', at: now })
        break
      case 'reply': {
        if (!this.replyAt.has(e.id)) this.replyAt.set(e.id, now)
        this.h.onChat(botId, { id: e.id, from: botId, text: e.text, at: this.replyAt.get(e.id)!, streaming: true })
        break
      }
      case 'activity':
        this.h.onActivity({ id: uid('act'), botId, text: e.text, kind: e.kind, at: now })
        break
      case 'permission': {
        const list = [...(this.pending.get(botId) ?? []).filter((r) => r.requestId !== e.request.requestId), e.request]
        this.pending.set(botId, list)
        this.h.onPermission(botId, list)
        break
      }
      case 'permission-resolved': {
        const list = (this.pending.get(botId) ?? []).filter((r) => r.requestId !== e.requestId)
        this.pending.set(botId, list)
        this.h.onPermission(botId, list)
        this.h.onActivity({
          id: uid('act'),
          botId,
          text: e.allow ? 'You allowed the step' : 'You denied the step',
          kind: e.allow ? 'result' : 'thought',
          at: now,
        })
        break
      }
      case 'result': {
        this.h.onRun(botId, e.lastRun)
        const files = e.files ?? []
        if (e.ok) {
          this.h.onActivity({ id: uid('act'), botId, text: summaryLine(e.lastRun), kind: 'result', at: now })
        } else {
          this.h.onActivity({ id: uid('act'), botId, text: `Run ended: ${clip(e.error ?? 'error', 120)}`, kind: 'thought', at: now })
          if (!e.text) {
            this.h.onChat(botId, { id: e.runId, from: botId, text: `(Run ended: ${e.error ?? 'error'})`, at: now })
          }
        }
        if (files.length) {
          this.h.onChanges({ id: e.runId, botId, prompt: e.prompt, summary: e.text, files, diff: e.diff, at: now })
        }
        break
      }
    }
  }
}

function summaryLine(run: AgentRun): string {
  const files = run.files ?? 0
  const parts = [
    run.turns != null ? `${run.turns} turns` : '',
    `${Math.max(1, Math.round(run.durationMs / 1000))} s`,
    run.costUsd != null ? `$${run.costUsd.toFixed(2)}` : '',
    files ? `${files} file${files > 1 ? 's' : ''} changed` : 'no file changes',
  ].filter(Boolean)
  return `Finished · ${parts.join(' · ')}`
}
