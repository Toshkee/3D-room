import { useEffect, useRef } from 'react'
import { useLounge } from '../state/LoungeContext'
import { ROLE_META } from '../theme'
import { Avatar } from './Avatar'
import { StatusPill } from './StatusPill'
import { ProgressBar } from './ProgressBar'
import { ActivityFeed } from './ActivityFeed'
import { ChatThread } from './ChatThread'
import { ROLE_ICON, X } from './icons'
import { botStarters } from '../data/prompts'

// The slide-in detail panel for one bot: identity + live task, an activity feed
// on top, and a 1:1 chat underneath. Shown as an overlay in any view.
export function BotPanel() {
  const { bots, selectedId, selectBot, activity, chats, sendChat, reducedMotion } = useLounge()
  const ref = useRef<HTMLDivElement>(null)
  const bot = bots.find((b) => b.id === selectedId) ?? null

  useEffect(() => {
    if (!bot) return
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') selectBot(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [bot, selectBot])

  if (!bot) return null
  const lines = activity[bot.id] ?? []
  const msgs = chats[bot.id] ?? []
  const RoleIcon = ROLE_ICON[bot.role]

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
      </div>

      <section className="panel__section">
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
