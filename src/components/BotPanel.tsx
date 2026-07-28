import { useEffect, useRef, useState } from 'react'
import type { Artifact } from '../types'
import { useLounge } from '../state/LoungeContext'
import { ROLE_META } from '../theme'
import { Avatar } from './Avatar'
import { StatusPill } from './StatusPill'
import { ProgressBar } from './ProgressBar'
import { ActivityFeed } from './ActivityFeed'
import { ChatThread } from './ChatThread'
import { ArrowUp, Check, Copy, Package, ROLE_ICON, X } from './icons'
import { botStarters } from '../data/prompts'
import { fmtTime } from '../util'

// The slide-in detail panel for one bot: identity + live task, an activity feed
// on top, and a 1:1 chat underneath. Shown as an overlay in any view.
export function BotPanel() {
  const {
    bots,
    selectedId,
    selectBot,
    activity,
    chats,
    artifacts,
    sendChat,
    assignTask,
    reducedMotion,
  } = useLounge()
  const ref = useRef<HTMLDivElement>(null)
  const [brief, setBrief] = useState('')
  const bot = bots.find((b) => b.id === selectedId) ?? null

  // Focus the panel only when it OPENS (or switches bot). Depending on the bot
  // object itself would re-run on every progress tick and yank focus out of
  // whatever field you're typing in.
  const botId = bot?.id ?? null
  useEffect(() => {
    if (botId) ref.current?.focus()
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
  const works = artifacts[bot.id] ?? []
  const RoleIcon = ROLE_ICON[bot.role]

  const submitBrief = (e: React.FormEvent) => {
    e.preventDefault()
    const t = brief.trim()
    if (!t) return
    assignTask(bot.id, t)
    setBrief('')
  }

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
          <div className="panel__name">
            {bot.name}
            <span className="panel__role">
              <RoleIcon size={12} strokeWidth={2.4} />
              {ROLE_META[bot.role].label}
            </span>
          </div>
          <div className="panel__blurb">{bot.blurb}</div>
        </div>
        <button className="icon-btn" onClick={() => selectBot(null)} aria-label="Close panel">
          <X size={18} />
        </button>
      </header>

      <div className="panel__task">
        <div className="panel__task-row">
          <StatusPill status={bot.status} />
          <span className="panel__task-name">{bot.task}</span>
          <span className="panel__pct">{Math.round(bot.progress)}%</span>
        </div>
        <ProgressBar value={bot.progress} accent={bot.accent} />
        <form className="assign" onSubmit={submitBrief}>
          <input
            value={brief}
            onChange={(e) => setBrief(e.target.value)}
            placeholder={`Assign work — e.g. "Draft a tweet about the launch"`}
            aria-label={`Assign work to ${bot.name}`}
          />
          <button
            type="submit"
            className="assign__btn"
            disabled={!brief.trim()}
            aria-label="Assign task"
          >
            <ArrowUp size={16} strokeWidth={2.6} />
          </button>
        </form>
      </div>

      {works.length > 0 && (
        <section className="panel__section panel__section--artifacts">
          <h3 className="panel__h">
            <Package size={13} strokeWidth={2.4} /> Artifacts ({works.length})
          </h3>
          <div className="artifacts">
            {works
              .slice()
              .reverse()
              .map((a) => (
                <ArtifactCard key={a.id} artifact={a} />
              ))}
          </div>
        </section>
      )}

      <section className="panel__section panel__section--feed">
        <h3 className="panel__h">Activity feed</h3>
        <ActivityFeed lines={lines} reducedMotion={reducedMotion} />
      </section>

      <section className="panel__section panel__section--chat">
        <h3 className="panel__h">Chat with {bot.name}</h3>
        <ChatThread
          messages={msgs}
          bots={[bot]}
          onSend={(t) => sendChat(bot.id, t)}
          reducedMotion={reducedMotion}
          placeholder={`Message ${bot.name}…`}
          suggestions={botStarters(bot)}
        />
      </section>
    </aside>
  )
}

function ArtifactCard({ artifact }: { artifact: Artifact }) {
  const [copied, setCopied] = useState(false)
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(artifact.content)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked — nothing to do */
    }
  }
  return (
    <details className="artifact">
      <summary className="artifact__head">
        <span className="artifact__title">{artifact.title}</span>
        <span className="artifact__time">{fmtTime(artifact.at)}</span>
      </summary>
      <div className="artifact__body">
        <button type="button" className="artifact__copy" onClick={copy}>
          {copied ? <Check size={13} strokeWidth={2.6} /> : <Copy size={13} strokeWidth={2.2} />}
          {copied ? 'Copied' : 'Copy'}
        </button>
        <pre className="artifact__content">{artifact.content}</pre>
      </div>
    </details>
  )
}
