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
import type { ActivityLine, Bot, Message, Role, Theme, View } from '../types'
import { CREW, SEATS, firstOpenSeat } from '../data/bots'
import { ROLE_META } from '../theme'
import { SimulatedBotEngine } from '../engine/SimulatedBotEngine'
import { ACTIVITY, TASKS, pick } from '../engine/content'
import type { BotEngine } from '../engine/BotEngine'
import { usePrefersReducedMotion } from '../usePrefersReducedMotion'

const ACTIVITY_CAP = 40
const GROUP_CAP = 60

let seq = 0
const uid = (p: string) => `${p}-${++seq}`

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
  activity: Record<string, ActivityLine[]>
  chats: Record<string, Message[]>
  group: Message[]
  // actions
  setView(v: View): void
  toggleTheme(): void
  selectBot(id: string | null): void
  sendChat(botId: string, text: string): void
  sendGroup(text: string): void
  addBot(input: NewBot): Bot
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

  const [bots, setBots] = useState<Bot[]>(CREW)
  const [view, setView] = useState<View>('lounge')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [activity, setActivity] = useState<Record<string, ActivityLine[]>>(() =>
    seedActivity(CREW),
  )
  const [chats, setChats] = useState<Record<string, Message[]>>({})
  const [group, setGroup] = useState<Message[]>(() => seedGroup(CREW))
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

  // Keep a live ref of bots so the engine always reads the current roster.
  const botsRef = useRef(bots)
  botsRef.current = bots

  // --- engine wiring (created once) -----------------------------------------
  const engineRef = useRef<BotEngine | null>(null)
  if (!engineRef.current) {
    engineRef.current = new SimulatedBotEngine(() => botsRef.current, {
      onActivity: (line) =>
        setActivity((prev) => {
          const list = [...(prev[line.botId] ?? []), line].slice(-ACTIVITY_CAP)
          return { ...prev, [line.botId]: list }
        }),
      onStatus: (botId, patch) =>
        setBots((prev) => prev.map((b) => (b.id === botId ? { ...b, ...patch } : b))),
      onChat: (botId, message) =>
        setChats((prev) => ({ ...prev, [botId]: [...(prev[botId] ?? []), message] })),
      onGroup: (message) => setGroup((prev) => [...prev, message].slice(-GROUP_CAP)),
    })
  }

  useEffect(() => {
    const engine = engineRef.current!
    engine.start()
    return () => engine.stop()
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
      activity,
      chats,
      group,
      setView,
      toggleTheme,
      selectBot,
      sendChat,
      sendGroup,
      addBot,
    }),
    [
      bots,
      theme,
      view,
      selectedId,
      reducedMotion,
      activity,
      chats,
      group,
      toggleTheme,
      selectBot,
      sendChat,
      sendGroup,
      addBot,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useLounge(): LoungeState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useLounge must be used within LoungeProvider')
  return ctx
}
