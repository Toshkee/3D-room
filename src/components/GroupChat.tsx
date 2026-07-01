import { useLounge } from '../state/LoungeContext'
import { Avatar } from './Avatar'
import { ChatThread } from './ChatThread'

// The shared channel where the bots talk to each other — and where the human
// can jump in. Same ChatThread as 1:1, with author labels on.
export function GroupChat() {
  const { bots, group, sendGroup, reducedMotion } = useLounge()
  return (
    <div className="group">
      <header className="group__head">
        <div className="group__title">
          <h2># team-channel</h2>
          <p>The bots coordinate here. Jump in anytime.</p>
        </div>
        <div className="group__members">
          {bots.slice(0, 8).map((b) => (
            <span key={b.id} className="group__member" title={b.name}>
              <Avatar bot={b} size={30} />
            </span>
          ))}
        </div>
      </header>
      <ChatThread
        messages={group}
        bots={bots}
        onSend={sendGroup}
        reducedMotion={reducedMotion}
        placeholder="Message the team…"
        showAuthors
      />
    </div>
  )
}
