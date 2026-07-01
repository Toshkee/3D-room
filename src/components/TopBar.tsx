import { useLounge } from '../state/LoungeContext'
import type { View } from '../types'
import { RobotFace } from './RobotFace'
import { Gamepad2, LayoutGrid, MessagesSquare, Moon, Sun, Plus } from './icons'

const TABS: { id: View; label: string; Icon: typeof Gamepad2 }[] = [
  { id: 'lounge', label: 'Lounge', Icon: Gamepad2 },
  { id: 'dashboard', label: 'Dashboard', Icon: LayoutGrid },
  { id: 'group', label: 'Team chat', Icon: MessagesSquare },
]

export function TopBar({ onImport }: { onImport: () => void }) {
  const { view, setView, theme, toggleTheme, bots } = useLounge()
  return (
    <header className="topbar">
      <div className="brand">
        <span className="brand__mark" aria-hidden>
          <RobotFace accent="#ffffff" size={30} />
        </span>
        <span className="brand__text">
          <span className="brand__name">AI Lounge</span>
          <span className="brand__sub">{bots.length} bots online</span>
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
          </button>
        ))}
      </nav>

      <div className="topbar__actions">
        <button
          className="icon-btn icon-btn--ghost"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`}
          title="Toggle theme"
        >
          {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
        </button>
        <button className="btn btn--accent" onClick={onImport}>
          <Plus size={17} strokeWidth={2.6} />
          <span className="btn__label">Import bot</span>
        </button>
      </div>
    </header>
  )
}
