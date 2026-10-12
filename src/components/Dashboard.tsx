import { useLounge } from '../state/LoungeContext'
import type { AgentRun, Bot } from '../types'
import { Avatar } from './Avatar'
import { StatusPill } from './StatusPill'
import { EmptyState } from './EmptyState'
import { FolderGit2, Hand } from './icons'
import { fmtAgo } from '../util'

// Every repo at a glance: who needs you, who's working, what the last run did.
// Clicking a card opens that bot's panel (where you answer, chat, see diffs).
export function Dashboard({ onAddRepo }: { onAddRepo: () => void }) {
  const { bots, activity, permissions, runs, selectBot } = useLounge()
  const waiting = bots.filter((b) => (permissions[b.id] ?? []).length).length
  const working = bots.filter((b) => b.status === 'working' || b.status === 'thinking').length
  const summary = [
    `${bots.length} repo${bots.length === 1 ? '' : 's'}`,
    waiting ? `${waiting} need${waiting === 1 ? 's' : ''} you` : '',
    working ? `${working} working` : '',
  ]
    .filter(Boolean)
    .join(' · ')

  if (!bots.length) {
    return (
      <div className="dashboard dashboard--empty">
        <EmptyState onAddRepo={onAddRepo} />
      </div>
    )
  }

  return (
    <div className="dashboard">
      <div className="dashboard__head">
        <h2>Dashboard</h2>
        <p>{summary}</p>
      </div>
      <div className="grid">
        {bots.map((bot) => (
          <RepoCard
            key={bot.id}
            bot={bot}
            ask={(permissions[bot.id] ?? [])[0]?.summary}
            lastLine={(activity[bot.id] ?? []).at(-1)?.text}
            onOpen={() => selectBot(bot.id)}
            run={runs[bot.id]}
          />
        ))}
      </div>
    </div>
  )
}

function RepoCard({
  bot,
  ask,
  lastLine,
  run,
  onOpen,
}: {
  bot: Bot
  ask: string | undefined
  lastLine: string | undefined
  run: AgentRun | undefined
  onOpen: () => void
}) {
  const busy = bot.status === 'working' || bot.status === 'thinking' || bot.status === 'waiting'
  const files = run?.files
  return (
    <button
      className="card"
      data-waiting={ask ? true : undefined}
      style={{ '--a': bot.accent } as React.CSSProperties}
      onClick={onOpen}
    >
      <div className="card__top">
        <Avatar bot={bot} size={46} />
        <div className="card__id">
          <span className="card__name">{bot.name}</span>
          <span className="card__repo">
            <FolderGit2 size={12} strokeWidth={2.4} />
            <span>{bot.agent.path}</span>
          </span>
        </div>
        <StatusPill status={bot.status} />
      </div>

      {ask && (
        <p className="card__ask">
          <Hand size={13} strokeWidth={2.4} /> Waiting for your OK: {ask}
        </p>
      )}

      <p className="card__task">
        <span className="card__label">{busy ? 'Now' : run?.prompt ? 'Last' : 'Ready'}</span>
        {busy
          ? bot.task
          : (run?.prompt ?? (run ? 'Open it to pick up where you left off.' : 'No runs yet — open it and ask for something.'))}
      </p>

      {busy && lastLine && <p className="card__last">{lastLine}</p>}

      <div className="card__meta">
        <span className="card__chip">
          {bot.agent.model} · {bot.agent.effort}
        </span>
        {run && (
          <span>
            {run.ok ? 'Finished' : 'Ended early'} {fmtAgo(run.at)}
            {files != null && ` · ${files} file${files === 1 ? '' : 's'}`}
            {run.costUsd != null && ` · $${run.costUsd.toFixed(2)}`}
          </span>
        )}
      </div>
    </button>
  )
}
