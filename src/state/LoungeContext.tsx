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
import { sceneBus } from './sceneBus'
import { loungeAudio } from '../audio/loungeAudio'

const ACTIVITY_CAP = 40
const GROUP_CAP = 60
const ARTIFACT_CAP = 20
const STORAGE_KEY = 'ai-lounge-state-v1'
const SOUND_KEY = 'ai-lounge-sound'

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

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

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
  /** Ambient sound + chimes (off until the user turns it on). */
  sound: boolean
  /** Which engine is driving the bots: the local sim, or live Claude via the proxy. */
  engineKind: 'simulated' | 'claude'
  activity: Record<string, ActivityLine[]>
  chats: Record<string, Message[]>
  group: Message[]
  artifacts: Record<string, Artifact[]>
  // actions
  setView(v: View): void
  toggleTheme(): void
  toggleSound(): void
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

  const [sound, setSound] = useState<boolean>(() => {
    try {
      return localStorage.getItem(SOUND_KEY) === '1'
    } catch {
      return false
    }
  })
  useEffect(() => {
    loungeAudio.setEnabled(sound)
    try {
      localStorage.setItem(SOUND_KEY, sound ? '1' : '0')
    } catch {
      /* ignore */
    }
  }, [sound])

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

  // --- scene cues (speech bubbles, celebrations, bots meeting up) ------------
  // Who last spoke in the team channel, so a reply from another bot reads as a
  // conversation between the two (one walks over to the other in the room).
  const lastGroupRef = useRef<{ from: string; at: number } | null>(null)
  const pairedRef = useRef(new Set<string>())
  const cueGroup = (message: Message) => {
    if (message.from === 'user') {
      lastGroupRef.current = { from: 'user', at: Date.now() }
      return
    }
    const text = message.text.trim()
    if (!text) {
      sceneBus.emit({ type: 'typing', botId: message.from })
      return
    }
    sceneBus.emit({ type: 'say', botId: message.from, id: message.id, text })
    const paired = pairedRef.current
    if (paired.has(message.id)) return
    if (paired.size > 300) paired.clear()
    paired.add(message.id)
    const roster = botsRef.current
    const mentioned = roster.find(
      (b) => b.id !== message.from && new RegExp(`(^|[^\\w])@?${escapeRe(b.name)}\\b`, 'i').test(text),
    )
    const last = lastGroupRef.current
    const partner =
      mentioned?.id ??
      (last && last.from !== message.from && last.from !== 'user' && Date.now() - last.at < 25000
        ? last.from
        : null)
    if (partner) sceneBus.emit({ type: 'converse', a: message.from, b: partner })
    lastGroupRef.current = { from: message.from, at: Date.now() }
  }

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
      onStatus: (botId, patch) => {
        if (patch.status === 'done') {
          const bot = botsRef.current.find((b) => b.id === botId)
          if (bot && bot.status !== 'done') {
            sceneBus.emit({ type: 'celebrate', botId })
            const task = patch.task ?? bot.task
            sceneBus.emit({ type: 'say', botId, id: `done-${botId}-${Date.now()}`, text: `Done: ${task}` })
          }
        }
        setBots((prev) => prev.map((b) => (b.id === botId ? { ...b, ...patch } : b)))
      },
      onChat: (botId, message) => {
        if (message.from !== 'user') {
          const text = message.text.trim()
          if (text) sceneBus.emit({ type: 'say', botId, id: message.id, text })
          else sceneBus.emit({ type: 'typing', botId })
        }
        setChats((prev) => ({ ...prev, [botId]: upsert(prev[botId] ?? [], message) }))
      },
      onGroup: (message) => {
        cueGroup(message)
        setGroup((prev) => upsert(prev, message).slice(-GROUP_CAP))
      },
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
  // Toggled from a click, so the effect above may start the audio context.
  const toggleSound = useCallback(() => setSound((on) => !on), [])

  const selectBot = useCallback((id: string | null) => setSelectedId(id), [])

  const sendChat = useCallback((botId: string, text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const msg: Message = { id: uid('u'), from: 'user', text: trimmed, at: Date.now() }
    setChats((prev) => ({ ...prev, [botId]: [...(prev[botId] ?? []), msg] }))
    sceneBus.emit({ type: 'typing', botId }) // the bot "composes" its reply
    engineRef.current!.sendChat(botId, trimmed)
  }, [])

  const sendGroup = useCallback((text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const msg: Message = { id: uid('u'), from: 'user', text: trimmed, at: Date.now() }
    setGroup((prev) => [...prev, msg].slice(-GROUP_CAP))
    lastGroupRef.current = { from: 'user', at: Date.now() }
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
    sceneBus.markEntering(id) // walks in through the door
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
      sound,
      engineKind,
      activity,
      chats,
      group,
      artifacts,
      setView,
      toggleTheme,
      toggleSound,
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
      sound,
      engineKind,
      activity,
      chats,
      group,
      artifacts,
      toggleTheme,
      toggleSound,
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
