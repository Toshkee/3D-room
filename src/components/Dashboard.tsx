import { useLounge } from '../state/LoungeContext'
import { ROLE_META } from '../theme'
import { Avatar } from './Avatar'
import { StatusPill } from './StatusPill'
import { ProgressBar } from './ProgressBar'
import { ROLE_ICON } from './icons'

// A grid view of every bot: identity, current task, status, progress, and the
// latest thing it did. Clicking a card opens that bot's panel.
export function Dashboard() {
  const { bots, activity, selectBot } = useLounge()
  return (
    <div className="dashboard">
      <div className="dashboard__head">
        <h2>Dashboard</h2>
        <p>{bots.length} bots in the lounge · live status</p>
      </div>
      <div className="grid">
        {bots.map((bot) => {
          const lines = activity[bot.id] ?? []
          const last = lines[lines.length - 1]
          const RoleIcon = ROLE_ICON[bot.role]
          return (
            <button
              key={bot.id}
              className="card"
              style={{ '--a': bot.accent } as React.CSSProperties}
              onClick={() => selectBot(bot.id)}
            >
              <div className="card__top">
                <Avatar bot={bot} size={46} />
                <div className="card__id">
                  <span className="card__name">{bot.name}</span>
                  <span className="card__role">
                    <RoleIcon size={13} strokeWidth={2.4} />
                    {ROLE_META[bot.role].label}
                  </span>
                </div>
                <StatusPill status={bot.status} />
              </div>
              <p className="card__task">{bot.task}</p>
              <div className="card__progress">
                <ProgressBar value={bot.progress} accent={bot.accent} />
                <span className="card__pct">{Math.round(bot.progress)}%</span>
              </div>
              <p className="card__last">{last ? last.text : 'Warming up…'}</p>
            </button>
          )
        })}
      </div>
    </div>
  )
}
