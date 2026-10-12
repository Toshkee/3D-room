import { useLounge } from '../state/LoungeContext'
import type { View } from '../types'
import { RobotFace } from './RobotFace'
import { Bell, BellOff, FolderPlus, Gamepad2, LayoutGrid, Moon, Sun, Volume2, VolumeX } from './icons'

const TABS: { id: View; label: string; Icon: typeof Gamepad2 }[] = [
  { id: 'lounge', label: 'Lounge', Icon: Gamepad2 },
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutGrid },
]

export function TopBar({ onAddRepo }: { onAddRepo: () => void }) {
  const {
    view,
    setView,
    theme,
    toggleTheme,
    sound,
    toggleSound,
    notifications,
    toggleNotifications,
    bots,
    connection,
    permissions,
  } = useLounge()
  const waiting = Object.values(permissions).filter((l) => l.length).length
  const repos = `${bots.length} repo${bots.length === 1 ? '' : 's'}`
  const sub =
    connection === 'offline' ? 'Server offline' : connection === 'connecting' ? 'Connecting…' : `${repos} · connected`
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand__mark" aria-hidden>
          <RobotFace accent="#ffffff" size={30} />
        </span>
        <span className="brand__text">
          <span className="brand__name">AI Lounge</span>
          <span className="brand__sub" data-conn={connection}>
            <span className="brand__dot" aria-hidden />
            {sub}
          </span>
        </span>
      </div>

      <nav className="tabs" aria-label="Views">
        {TABS.map(({ id, label, Icon }) => (
          <button
            key={id}
            className="tab"
            data-active={view === id || undefined}
            onClick={() => setView(id)}
          >
            <Icon size={16} strokeWidth={2.4} />
            <span className="tab__label">{label}</span>
            {id === 'dashboard' && waiting > 0 && (
              <span className="tab__count" aria-label={`${waiting} waiting for you`}>
                {waiting}
              </span>
            )}
          </button>
        ))}
      </nav>

      <div className="topbar__actions">
        {notifications !== 'unsupported' && (
          <button
            className="icon-btn icon-btn--ghost topbar__notify"
            onClick={toggleNotifications}
            aria-pressed={notifications === 'on'}
            aria-label={notifications === 'on' ? 'Turn notifications off' : 'Turn notifications on'}
            title={
              notifications === 'on'
                ? 'Notifications on: you hear from bots when the lounge is in the background'
                : notifications === 'blocked'
                  ? 'Notifications are blocked for this site — allow them in the browser settings'
                  : 'Notify me when a bot needs me or finishes'
            }
            data-on={notifications === 'on' || undefined}
          >
            {notifications === 'on' ? <Bell size={18} /> : <BellOff size={18} />}
          </button>
        )}
        <button
          className="icon-btn icon-btn--ghost"
          onClick={toggleSound}
          aria-pressed={sound}
          aria-label={sound ? 'Turn ambient sound off' : 'Turn ambient sound on'}
          title={sound ? 'Sound on' : 'Sound off'}
          data-on={sound || undefined}
        >
          {sound ? <Volume2 size={18} /> : <VolumeX size={18} />}
        </button>
        <button
          className="icon-btn icon-btn--ghost"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          title="Toggle theme"
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        <button className="btn btn--accent" onClick={onAddRepo} aria-label="Add repo">
          <FolderPlus size={17} strokeWidth={2.4} />
          <span className="btn__label">Add repo</span>
        </button>
      </div>
    </header>
  )
}
