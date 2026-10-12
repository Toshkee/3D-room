import { useCallback, useState } from 'react'
import { LoungeProvider, useLounge } from './state/LoungeContext'
import { TopBar } from './components/TopBar'
import { Lounge3D } from './scene/Lounge3D'
import { Dashboard } from './components/Dashboard'
import { BotPanel } from './components/BotPanel'
import { AddRepoModal } from './components/AddRepoModal'
import { EmptyState, OfflineBanner } from './components/EmptyState'

function LoungeView({ onAddRepo }: { onAddRepo: () => void }) {
  const { bots, theme, selectedId, selectBot, reducedMotion } = useLounge()
  return (
    <div className="stage">
      <Lounge3D
        bots={bots}
        theme={theme}
        selectedId={selectedId}
        onSelect={selectBot}
        reducedMotion={reducedMotion}
      />
      {bots.length === 0 ? (
        <div className="stage__empty">
          <EmptyState onAddRepo={onAddRepo} />
        </div>
      ) : (
        <p className="stage__hint" aria-hidden>
          Drag to look around · scroll to zoom · click a bot to open it
        </p>
      )}
    </div>
  )
}

function AppInner() {
  const { view, selectedId } = useLounge()
  const [addOpen, setAddOpen] = useState(false)
  // Stable callbacks — the lounge state updates constantly, and fresh closures
  // here would invalidate effects in the children on every tick.
  const openAdd = useCallback(() => setAddOpen(true), [])
  const closeAdd = useCallback(() => setAddOpen(false), [])

  return (
    <div className="app" data-panel={selectedId ? 'open' : undefined}>
      <TopBar onAddRepo={openAdd} />
      <OfflineBanner />
      <main className="main">
        {view === 'lounge' && <LoungeView onAddRepo={openAdd} />}
        {view === 'dashboard' && <Dashboard onAddRepo={openAdd} />}
      </main>
      <BotPanel />
      {addOpen && <AddRepoModal onClose={closeAdd} />}
    </div>
  )
}

export default function App() {
  return (
    <LoungeProvider>
      <AppInner />
    </LoungeProvider>
  )
}
