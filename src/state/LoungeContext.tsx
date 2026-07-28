import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { ActivityLine, Artifact, Bot, Message, Role, Theme, View } from '../types'
import { CREW, SEATS, firstOpenSeat } from '../data/bots'
import { ROLE_META } from '../theme'
import { SimulatedBotEngine } from '../engine/SimulatedBotEngine'
import { ClaudeBotEngine } from '../engine/ClaudeBotEngine'
import { ACTIVITY, TASKS, pick } from '../engine/content'
import type { BotEngine, EngineHandlers } from '../engine/BotEngine'
import { usePrefersReducedMotion } from '../usePrefersReducedMotion'

const ACTIVITY_CAP = 40
const GROUP_CAP = 60
const ARTIFACT_CAP = 20
const STORAGE_KEY = 'ai-lounge-state-v1'

let seq = 0
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${++seq}`

// --- persistence -------------------------------------------------------------

interface SavedState {
  bots: Bot[]
  activity: Record<string, ActivityLine[]>
  chats: Record<string, Message[]>
  group: Message[]
  artifacts: Record<string, Artifact[]>
}

function loadSaved(): SavedState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as SavedState
    if (!Array.isArray(s.bots) || !s.bots.length) return null
    return s
  } catch {
    return null
  }
}

const SAVED = typeof localStorage !== 'undefined' ? loadSaved() : null

/** Append, or replace in place when a message with the same id exists (streaming). */
function upsert(list: Message[], message: Message): Message[] {
  const i = list.findIndex((m) => m.id === message.id)
  if (i < 0) return [...list, message]
  const next = list.slice()
  next[i] = message
  return next
}

export interface NewBot {
  name: string
  role: Role
  accent: string
  blurb: string
}

interface LoungeState {
  bots: Bot[]
  theme: Theme
  view: View
  selectedId: string | null
  reducedMotion: boolean
  /** Which engine is driving the bots: the local sim, or live Claude via the proxy. */
  engineKind: 'simulated' | 'claude'
  activity: Record<string, ActivityLine[]>
  chats: Record<string, Message[]>
  group: Message[]
  artifacts: Record<string, Artifact[]>
  // actions
  setView(v: View): void
  toggleTheme(): void
  selectBot(id: string | null): void
  sendChat(botId: string, text: string): void
  sendGroup(text: string): void
  assignTask(botId: string, brief: string): void
  addBot(input: NewBot): Bot
  resetLounge(): void
}

const Ctx = createContext<LoungeState | null>(null)

// --- initial simulation state ------------------------------------------------

function seedActivity(bots: Bot[]): Record<string, ActivityLine[]> {
  const out: Record<string, ActivityLine[]> = {}
  for (const b of bots) {
    out[b.id] = [pick(ACTIVITY[b.role]), pick(ACTIVITY[b.role])].map((l) => ({
      id: uid('act'),
      botId: b.id,
      text: l.text,
      kind: l.kind,
      at: Date.now(),
    }))
  }
  return out
}

function seedGroup(bots: Bot[]): Message[] {
  // A short, coherent opener so the channel isn't empty on first open.
  const coord = bots.find((b) => b.role === 'coordinator') ?? bots[0]
  const res = bots.find((b) => b.role === 'researcher') ?? bots[1] ?? bots[0]
  const eng = bots.find((b) => b.role === 'engineer') ?? bots[0]
  const msgs: Omit<Message, 'id' | 'at'>[] = [
    { from: coord.id, text: 'Morning team — let’s make today count.' },
    { from: res.id, text: 'Dropped my findings in the doc: rerank, then cache.' },
    { from: eng.id, text: 'Nice. I’ll wire it into the API layer this morning.' },
    { from: coord.id, text: 'Ping me if anything blocks 🙌' },
  ]
  return msgs.map((m, i) => ({ ...m, id: uid('grp'), at: Date.now() - (4 - i) * 60000 }))
}

export function LoungeProvider({ children }: { children: ReactNode }) {
  const reducedMotion = usePrefersReducedMotion()

  const [bots, setBots] = useState<Bot[]>(() => SAVED?.bots ?? CREW)
  const [view, setView] = useState<View>('lounge')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activity, setActivity] = useState<Record<string, ActivityLine[]>>(
    () => SAVED?.activity ?? seedActivity(CREW),
  )
  const [chats, setChats] = useState<Record<string, Message[]>>(() => SAVED?.chats ?? {})
  const [group, setGroup] = useState<Message[]>(() => SAVED?.group ?? seedGroup(CREW))
  const [artifacts, setArtifacts] = useState<Record<string, Artifact[]>>(
    () => SAVED?.artifacts ?? {},
  )
  const [theme, setTheme] = useState<Theme>(() => {
    const saved =
      typeof localStorage !== 'undefined' && localStorage.getItem('ai-lounge-theme')
    return saved === 'dark' || saved === 'light' ? saved : 'light'
  })

  // Apply theme to <html> + persist.
  useEffect(() => {
    document.documentElement.dataset.theme = theme
    const meta = document.querySelector('meta[name="theme-color"]')
    if (meta) meta.setAttribute('content', theme === 'dark' ? '#0e0a1c' : '#f6f4fe')
    try {
      localStorage.setItem('ai-lounge-theme', theme)
    } catch {
      /* ignore private-mode failures */
    }
  }, [theme])

  // Keep live refs so the engine always reads current state (roster, and the
  // conversation histories used to seed the Claude engine on hot-swap).
  const botsRef = useRef(bots)
  botsRef.current = bots
  const chatsRef = useRef(chats)
  chatsRef.current = chats
  const groupRef = useRef(group)
  groupRef.current = group

  // Persist everything the room accumulates (debounced; theme is stored
  // separately under its own key).
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const state: SavedState = { bots, activity, chats, group, artifacts }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch {
        /* storage full/blocked — persistence is best-effort */
      }
    }, 400)
    return () => clearTimeout(id)
  }, [bots, activity, chats, group, artifacts])

  // --- engine wiring (created once) -----------------------------------------
  const [engineKind, setEngineKind] = useState<'simulated' | 'claude'>('simulated')
  const handlersRef = useRef<EngineHandlers | null>(null)
  if (!handlersRef.current) {
    handlersRef.current = {
      onActivity: (line) =>
        setActivity((prev) => {
          const list = [...(prev[line.botId] ?? []), line].slice(-ACTIVITY_CAP)
          return { ...prev, [line.botId]: list }
        }),
      onStatus: (botId, patch) =>
        setBots((prev) => prev.map((b) => (b.id === botId ? { ...b, ...patch } : b))),
      onChat: (botId, message) =>
        setChats((prev) => ({ ...prev, [botId]: upsert(prev[botId] ?? [], message) })),
      onGroup: (message) => setGroup((prev) => upsert(prev, message).slice(-GROUP_CAP)),
      onArtifact: (artifact) =>
        setArtifacts((prev) => ({
          ...prev,
          [artifact.botId]: [...(prev[artifact.botId] ?? []), artifact].slice(-ARTIFACT_CAP),
        })),
    }
  }
  const engineRef = useRef<BotEngine | null>(null)
  if (!engineRef.current) {
    engineRef.current = new SimulatedBotEngine(() => botsRef.current, handlersRef.current)
  }

  useEffect(() => {
    let cancelled = false
    engineRef.current!.start()
    // Probe the local Claude proxy; if it's up, hot-swap in the real engine.
    // Without a proxy the room keeps running on the simulation.
    ;(async () => {
      try {
        const res = await fetch('/api/health')
        if (!res.ok) return
        const info = (await res.json()) as { ok?: boolean }
        if (cancelled || !info.ok) return
        engineRef.current!.stop()
        const claude = new ClaudeBotEngine(() => botsRef.current, handlersRef.current!)
        claude.seed(chatsRef.current, groupRef.current) // bots remember past sessions
        engineRef.current = claude
        engineRef.current.start()
        setEngineKind('claude')
      } catch {
        /* proxy not running — stay on the simulation */
      }
    })()
    return () => {
      cancelled = true
      engineRef.current!.stop()
    }
  }, [])

  // --- actions --------------------------------------------------------------
  const toggleTheme = useCallback(
    () => setTheme((t) => (t === 'light' ? 'dark' : 'light')),
    [],
  )

  const selectBot = useCallback((id: string | null) => setSelectedId(id), [])

  const sendChat = useCallback((botId: string, text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const msg: Message = { id: uid('u'), from: 'user', text: trimmed, at: Date.now() }
    setChats((prev) => ({ ...prev, [botId]: [...(prev[botId] ?? []), msg] }))
    engineRef.current!.sendChat(botId, trimmed)
  }, [])

  const sendGroup = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const msg: Message = { id: uid('u'), from: 'user', text: trimmed, at: Date.now() }
    setGroup((prev) => [...prev, msg].slice(-GROUP_CAP))
    engineRef.current!.sendGroup(trimmed)
  }, [])

  const assignTask = useCallback((botId: string, brief: string) => {
    const trimmed = brief.trim()
    if (!trimmed) return
    engineRef.current!.assignTask(botId, trimmed)
  }, [])

  const resetLounge = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      /* ignore */
    }
    location.reload()
  }, [])

  const addBot = useCallback((input: NewBot): Bot => {
    const meta = ROLE_META[input.role]
    const id = `bot-${uid('n')}`
    const name = input.name.trim() || meta.label
    const bot: Bot = {
      id,
      name,
      role: input.role,
      accent: input.accent,
      blurb: input.blurb.trim() || `A ${meta.label.toLowerCase()} bot.`,
      seat: 0, // real seat assigned inside setBots against the live roster
      status: 'working',
      task: pick(TASKS[input.role]),
      progress: 5,
    }
    setBots((prev) => [...prev, { ...bot, seat: firstOpenSeat(prev) % SEATS.length }])
    setActivity((prev) => ({
      ...prev,
      [id]: [
        {
          id: uid('act'),
          botId: id,
          text: `Joined the lounge — starting: ${bot.task}`,
          kind: 'info',
          at: Date.now(),
        },
      ],
    }))
    return bot
  }, [])

  const value = useMemo<LoungeState>(
    () => ({
      bots,
      theme,
      view,
      selectedId,
      reducedMotion,
      engineKind,
      activity,
      chats,
      group,
      artifacts,
      setView,
      toggleTheme,
      selectBot,
      sendChat,
      sendGroup,
      assignTask,
      addBot,
      resetLounge,
    }),
    [
      bots,
      theme,
      view,
      selectedId,
      reducedMotion,
      engineKind,
      activity,
      chats,
      group,
      artifacts,
      toggleTheme,
      selectBot,
      sendChat,
      sendGroup,
      assignTask,
      addBot,
      resetLounge,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useLounge(): LoungeState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useLounge must be used within LoungeProvider')
  return ctx
}
