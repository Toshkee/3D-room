import { useLounge } from '../state/LoungeContext'
import { FolderPlus, PlugZap } from './icons'

// What the lounge shows with no repos yet: start the server first, then add
// a repo. Used over the 3D room and on the dashboard.
export function EmptyState({ onAddRepo }: { onAddRepo: () => void }) {
  const { connection } = useLounge()
  if (connection === 'connecting') return null
  if (connection === 'offline') {
    return (
      <div className="empty" role="status">
        <span className="empty__icon" aria-hidden>
          <PlugZap size={26} strokeWidth={2.2} />
        </span>
        <h2>Start the lounge server</h2>
        <p>
          Bots run Claude Code in your repos through a small local server. In the project folder, run{' '}
          <code>npm run server</code> — this page connects by itself.
        </p>
      </div>
    )
  }
  return (
    <div className="empty">
      <span className="empty__icon" aria-hidden>
        <FolderPlus size={26} strokeWidth={2.2} />
      </span>
      <h2>Add your first repo</h2>
      <p>
        Each repo gets a robot that works in it with Claude Code, on your login. It asks before it edits files or
        runs commands.
      </p>
      <button className="btn btn--accent" onClick={onAddRepo}>
        <FolderPlus size={17} strokeWidth={2.4} />
        Add repo
      </button>
    </div>
  )
}

/** A thin strip under the top bar while the server is unreachable. */
export function OfflineBanner() {
  const { connection, bots } = useLounge()
  if (connection !== 'offline' || !bots.length) return null
  return (
    <p className="offline" role="status">
      <PlugZap size={15} strokeWidth={2.4} />
      The lounge server is offline, so bots can't work. Run <code>npm run server</code> — this page reconnects by
      itself.
    </p>
  )
}
