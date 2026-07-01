import { useState } from 'react'
import { LoungeProvider, useLounge } from './state/LoungeContext'
import { TopBar } from './components/TopBar'
import { Lounge3D } from './scene/Lounge3D'
import { Dashboard } from './components/Dashboard'
import { GroupChat } from './components/GroupChat'
import { BotPanel } from './components/BotPanel'
import { ImportBotModal } from './components/ImportBotModal'

function LoungeView() {
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
      <p className="stage__hint" aria-hidden>
        Drag to look around · scroll to zoom · click a bot to open it
      </p>
    </div>
  )
}

function AppInner() {
  const { view, selectedId } = useLounge()
  const [importOpen, setImportOpen] = useState(false)

  return (
    <div className="app" data-panel={selectedId ? 'open' : undefined}>
      <TopBar onImport={() => setImportOpen(true)} />
      <main className="main">
        {view === 'lounge' && <LoungeView />}
        {view === 'dashboard' && <Dashboard />}
        {view === 'group' && <GroupChat />}
      </main>
      <BotPanel />
      {importOpen && <ImportBotModal onClose={() => setImportOpen(false)} />}
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
