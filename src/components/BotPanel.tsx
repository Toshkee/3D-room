import { useEffect, useRef, useState } from 'react'
import type { ActivityLine, AgentRun, Bot, Change, PermissionRequest } from '../types'
import { useLounge } from '../state/LoungeContext'
import { Avatar } from './Avatar'
import { StatusPill } from './StatusPill'
import { ActivityFeed } from './ActivityFeed'
import { ChatThread } from './ChatThread'
import { ChevronDown, ChevronRight, CircleStop, FolderGit2, Hand, RefreshCw, Settings2, Trash2, X } from './icons'
import { DiffModal, LineCounts, changeTotals } from './DiffModal'
import { EFFORTS, MODELS } from '../engine/RepoAgentLink'
import { fmtAgo, fmtTime } from '../util'

// The slide-in panel for one repo bot: who it is and where it works, the step
// it's waiting on (Allow / Deny), its Claude Code settings, what its runs
// changed, the live activity feed, and the chat you give it work through.
export function BotPanel() {
  const {
    bots,
    selectedId,
    selectBot,
    activity,
    chats,
    changes,
    sendChat,
    reducedMotion,
    permissions,
    runs,
    answerPermission,
    stopAgent,
    setAgentOptions,
    resetAgentSession,
    removeRepo,
    connection,
  } = useLounge()
  const ref = useRef<HTMLDivElement>(null)
  const bot = bots.find((b) => b.id === selectedId) ?? null
  // The run whose diff is open (from the Changes tab or a chat reply).
  const [viewing, setViewing] = useState<Change | null>(null)

  // Focus the panel only when it OPENS (or switches bot). Depending on the bot
  // object itself would re-run on every status tick and yank focus out of
  // whatever field you're typing in.
  const botId = bot?.id ?? null
  useEffect(() => {
    if (botId) ref.current?.focus()
    setViewing(null)
  }, [botId])

  useEffect(() => {
    if (!botId) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') selectBot(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [botId, selectBot])

  if (!bot) return null
  const lines = activity[bot.id] ?? []
  const msgs = chats[bot.id] ?? []
  const done = changes[bot.id] ?? []
  const pending = permissions[bot.id] ?? []
  const run = runs[bot.id]
  const busy = bot.status === 'working' || bot.status === 'waiting'
  // Why the composer can't send right now (it keeps your draft meanwhile).
  const blocked =
    connection !== 'online'
      ? connection === 'offline'
        ? 'Server offline — start it with npm run server'
        : 'Connecting…'
      : bot.status === 'waiting'
        ? `${bot.name} is waiting for your OK above`
        : bot.status === 'working'
          ? `${bot.name} is working — send when it's done, or Stop it`
          : null
  const repoHint = bot.name.toLowerCase() === bot.agent.repo.toLowerCase() ? '' : ` in ${bot.agent.repo}`

  return (
    <aside
      className="panel"
      role="dialog"
      aria-label={`${bot.name} details`}
      ref={ref}
      tabIndex={-1}
      style={{ '--a': bot.accent } as React.CSSProperties}
    >
      <header className="panel__head">
        <Avatar bot={bot} size={52} />
        <div className="panel__id">
          <div className="panel__name">{bot.name}</div>
          <div className="panel__repo" title={bot.agent.path}>
            <FolderGit2 size={13} strokeWidth={2.3} />
            <span className="panel__repo-path">{bot.agent.path}</span>
          </div>
          {bot.blurb && <div className="panel__blurb">{bot.blurb}</div>}
        </div>
        <button className="icon-btn" onClick={() => selectBot(null)} aria-label="Close panel">
          <X size={18} />
        </button>
      </header>

      {pending[0] && (
        <PermissionCard
          bot={bot}
          request={pending[0]}
          more={pending.length - 1}
          onAnswer={(allow) => answerPermission(bot.id, pending[0].requestId, allow)}
        />
      )}

      <div className="panel__task">
        <div className="panel__task-row">
          <StatusPill status={bot.status} />
          <span className="panel__task-name">{bot.task}</span>
        </div>
        <AgentControls
          key={bot.id}
          bot={bot}
          run={run}
          busy={busy}
          onOptions={(patch) => setAgentOptions(bot.id, patch)}
          onStop={() => stopAgent(bot.id)}
          onReset={() => resetAgentSession(bot.id)}
          onRemove={() => removeRepo(bot.id)}
        />
      </div>

      <WorkSection key={bot.id} lines={lines} changes={done} reducedMotion={reducedMotion} onView={setViewing} />

      <section className="panel__section panel__section--chat">
        <h3 className="panel__h">Chat with {bot.name}</h3>
        <ChatThread
          key={bot.id}
          messages={msgs}
          bots={[bot]}
          onSend={(t) => sendChat(bot.id, t)}
          reducedMotion={reducedMotion}
          placeholder={`Ask ${bot.name} to do something${repoHint}…`}
          suggestions={STARTERS}
          blocked={blocked}
          changes={done}
          onViewChange={setViewing}
        />
      </section>
      {viewing && <DiffModal change={viewing} onClose={() => setViewing(null)} />}
    </aside>
  )
}

const STARTERS = [
  'What is this repo and how is it organized?',
  'Any obvious bugs or TODOs worth fixing?',
  'Summarize the last few commits',
]

// "Oblun needs your OK": the step a repo agent is waiting on, with Allow / Deny.
function PermissionCard({
  bot,
  request,
  more,
  onAnswer,
}: {
  bot: Bot
  request: PermissionRequest
  more: number
  onAnswer: (allow: boolean) => void
}) {
  return (
    <section className="permit" role="alert" aria-label={`${bot.name} needs your OK`}>
      <div className="permit__head">
        <Hand size={15} strokeWidth={2.4} />
        {bot.name} needs your OK
      </div>
      <p className="permit__summary">{request.summary}</p>
      {request.detail && <pre className="permit__detail">{request.detail}</pre>}
      <div className="permit__actions">
        <button type="button" className="btn permit__deny" onClick={() => onAnswer(false)}>
          Deny
        </button>
        <button type="button" className="btn btn--accent permit__allow" onClick={() => onAnswer(true)}>
          Allow
        </button>
      </div>
      {more > 0 && (
        <p className="permit__more">
          {more} more step{more > 1 ? 's' : ''} waiting after this one
        </p>
      )}
    </section>
  )
}

// Model / effort, auto-approve edits, stop, fresh session, remove. The
// settings fold into one chip (they rarely change, the chat below needs the
// room) that shows the current model · effort and opens the rest. Remove is a
// trash button that asks once before it acts.
function AgentControls({
  bot,
  run,
  busy,
  onOptions,
  onStop,
  onReset,
  onRemove,
}: {
  bot: Bot
  run: AgentRun | undefined
  busy: boolean
  onOptions: (patch: { model?: string; effort?: string; autoEdits?: boolean }) => void
  onStop: () => void
  onReset: () => void
  onRemove: () => Promise<string | null>
}) {
  const agent = bot.agent
  const [open, setOpen] = useState(false)
  const [confirming, setConfirming] = useState(false)
  const [removeError, setRemoveError] = useState('')
  const cancelRef = useRef<HTMLButtonElement>(null)
  const remove = async () => {
    const err = await onRemove()
    if (err) setRemoveError(err)
  }
  // Land on the safe choice when the question opens.
  useEffect(() => {
    if (confirming) cancelRef.current?.focus()
  }, [confirming])
  const settingsId = `agent-settings-${bot.id}`
  return (
    <div className="agentbar">
      <div className="agentbar__row">
        <button
          type="button"
          className="agentbar__toggle"
          aria-expanded={open}
          aria-controls={settingsId}
          onClick={() => setOpen((o) => !o)}
        >
          <Settings2 size={13} strokeWidth={2.4} />
          {agent.model} · {agent.effort}
          {agent.autoEdits && <span className="agentbar__flag">auto-edits</span>}
          <ChevronDown size={13} strokeWidth={2.6} className="agentbar__chev" />
        </button>
        {busy ? (
          <button type="button" className="agentbar__btn agentbar__btn--stop" onClick={onStop}>
            <CircleStop size={14} strokeWidth={2.4} /> Stop
          </button>
        ) : (
          <button
            type="button"
            className="agentbar__btn"
            onClick={onReset}
            title="Forget this conversation and start fresh"
          >
            <RefreshCw size={13} strokeWidth={2.4} /> New session
          </button>
        )}
        <button
          type="button"
          className="agentbar__icon"
          aria-label={`Remove ${bot.name} from the lounge`}
          aria-expanded={confirming}
          title={busy ? 'Stop the run first' : 'Remove from the lounge'}
          disabled={busy}
          onClick={() => {
            setRemoveError('')
            setConfirming((c) => !c)
          }}
        >
          <Trash2 size={15} strokeWidth={2.3} />
        </button>
      </div>
      {confirming && !busy && (
        <div className="agentbar__confirm" role="group" aria-label={`Remove ${bot.name}`}>
          <span>Remove {bot.name} from the lounge? The repo's files stay as they are.</span>
          <div className="agentbar__confirm-actions">
            <button type="button" className="agentbar__btn" ref={cancelRef} onClick={() => setConfirming(false)}>
              Cancel
            </button>
            <button type="button" className="agentbar__btn agentbar__btn--stop" onClick={remove}>
              <Trash2 size={13} strokeWidth={2.4} /> Remove
            </button>
          </div>
          {removeError && (
            <p className="form__error" role="alert">
              {removeError}
            </p>
          )}
        </div>
      )}
      {run && (
        <p className="agentbar__run" title={run.costUsd != null ? 'Cost at API prices' : undefined}>
          Last run {fmtAgo(run.at)}
          {!run.ok && ' · ended early'}
          {run.files != null && ` · ${run.files} file${run.files === 1 ? '' : 's'} changed`}
          {` · ${Math.max(1, Math.round(run.durationMs / 1000))} s`}
          {run.costUsd != null && ` · $${run.costUsd.toFixed(2)}`}
        </p>
      )}
      {open && (
        <div className="agentbar__more" id={settingsId}>
          <div className="agentbar__fields">
            <label className="agentbar__field">
              <span>Model</span>
              <select value={agent.model} onChange={(e) => onOptions({ model: e.target.value })}>
                {MODELS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
            <label className="agentbar__field">
              <span>Effort</span>
              <select value={agent.effort} onChange={(e) => onOptions({ effort: e.target.value })}>
                {EFFORTS.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="agentbar__check">
            <input
              type="checkbox"
              checked={agent.autoEdits}
              onChange={(e) => onOptions({ autoEdits: e.target.checked })}
            />
            Auto-approve file edits (commands still ask)
          </label>
        </div>
      )}
    </div>
  )
}

type Tab = 'activity' | 'changes'

// What the bot is doing and what it changed, sharing one area so the chat
// below keeps its room. A dot on "Changes" means a run changed files since you
// last looked there.
function WorkSection({
  lines,
  changes,
  reducedMotion,
  onView,
}: {
  lines: ActivityLine[]
  changes: Change[]
  reducedMotion: boolean
  onView: (c: Change) => void
}) {
  const [tab, setTab] = useState<Tab>('activity')
  const latest = changes.length ? changes[changes.length - 1].id : null
  const [seen, setSeen] = useState(latest)
  const fresh = tab !== 'changes' && latest != null && latest !== seen
  const pick = (t: Tab) => {
    setTab(t)
    if (t === 'changes') setSeen(latest)
  }
  useEffect(() => {
    if (tab === 'changes') setSeen(latest)
  }, [tab, latest])

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'activity', label: 'Activity' },
    { id: 'changes', label: 'Changes', count: changes.length },
  ]
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
    e.preventDefault()
    const next: Tab = tab === 'activity' ? 'changes' : 'activity'
    pick(next)
    document.getElementById(`work-tab-${next}`)?.focus()
  }

  return (
    <section
      className="panel__section panel__section--work"
      data-empty={(tab === 'activity' ? !lines.length : !changes.length) || undefined}
    >
      <div className="seg" role="tablist" aria-label="Activity and changes" onKeyDown={onKey}>
        {tabs.map((t) => (
          <button
            key={t.id}
            id={`work-tab-${t.id}`}
            type="button"
            role="tab"
            className="seg__tab"
            aria-selected={tab === t.id}
            aria-controls={`work-panel-${t.id}`}
            tabIndex={tab === t.id ? 0 : -1}
            onClick={() => pick(t.id)}
          >
            {t.label}
            {t.count ? <span className="seg__count">{t.count}</span> : null}
            {t.id === 'changes' && fresh && <span className="seg__dot" aria-label="new" />}
          </button>
        ))}
      </div>
      <div className="work__panel" role="tabpanel" id={`work-panel-${tab}`} aria-labelledby={`work-tab-${tab}`}>
        {tab === 'activity' ? (
          <ActivityFeed lines={lines} reducedMotion={reducedMotion} />
        ) : (
          <ChangeList changes={changes} onView={onView} />
        )}
      </div>
    </section>
  )
}

// Every run that changed files, newest first. A row opens that run's diff.
function ChangeList({ changes, onView }: { changes: Change[]; onView: (c: Change) => void }) {
  if (!changes.length) {
    return <p className="feed__empty">When a run changes files, they show up here with the full diff.</p>
  }
  return (
    <ul className="changes">
      {changes
        .slice()
        .reverse()
        .map((c) => {
          const n = c.files.length
          const t = changeTotals(c.files)
          return (
            <li key={c.id}>
              <button type="button" className="change-row" onClick={() => onView(c)}>
                <span className="change-row__title">{c.prompt}</span>
                <span className="change-row__meta">
                  {n} file{n === 1 ? '' : 's'} <LineCounts add={t.add} del={t.del} /> · {fmtTime(c.at)}
                </span>
                <ChevronRight size={15} strokeWidth={2.4} className="change-row__chev" />
              </button>
            </li>
          )
        })}
    </ul>
  )
}
