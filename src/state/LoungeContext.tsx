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
import type {
  ActivityLine,
  AgentRun,
  Bot,
  Change,
  Connection,
  Message,
  PermissionRequest,
  RepoLink,
  Theme,
  View,
} from '../types'
import { SEATS, firstOpenSeat } from '../data/bots'
import {
  RepoAgentLink,
  agentBotId,
  type AgentInfo,
  type LinkHandlers,
  type RepoSuggestion,
} from '../engine/RepoAgentLink'
import { usePrefersReducedMotion } from '../usePrefersReducedMotion'
import { sceneBus } from './sceneBus'
import { loungeAudio } from '../audio/loungeAudio'

const ACTIVITY_CAP = 40
const CHAT_CAP = 200
const CHANGES_CAP = 20
const STORAGE_KEY = 'ai-lounge-state-v2'
const OLD_STORAGE_KEYS = ['ai-lounge-state-v1']
const SOUND_KEY = 'ai-lounge-sound'

let seq = 0
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${++seq}`

// --- persistence -------------------------------------------------------------
// The server owns the roster and the sessions; the browser keeps what it has
// seen (chats, feed, changes) plus the bots, so the room isn't empty while the
// server is starting or down, and every bot keeps its seat across reloads.

interface SavedState {
  bots: Bot[]
  activity: Record<string, ActivityLine[]>
  chats: Record<string, Message[]>
  changes: Record<string, Change[]>
}

function loadSaved(): SavedState | null {
  try {
    for (const key of OLD_STORAGE_KEYS) localStorage.removeItem(key) // the invented crew's era
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const s = JSON.parse(raw) as SavedState
    if (!Array.isArray(s.bots)) return null
    return { bots: s.bots.filter((b) => b.agent), activity: s.activity ?? {}, chats: s.chats ?? {}, changes: s.changes ?? {} }
  } catch {
    return null
  }
}

const SAVED = typeof localStorage !== 'undefined' ? loadSaved() : null

/** Append, or replace in place when a message with the same id exists (streaming). */
function upsert(list: Message[], message: Message): Message[] {
  const i = list.findIndex((m) => m.id === message.id)
  if (i < 0) return [...list, message].slice(-CHAT_CAP)
  const next = list.slice()
  next[i] = message
  return next
}

function without<T>(rec: Record<string, T>, key: string): Record<string, T> {
  if (!(key in rec)) return rec
  const next = { ...rec }
  delete next[key]
  return next
}

const linkOf = (a: AgentInfo): RepoLink => ({
  id: a.id,
  repo: a.repo,
  path: a.path,
  model: a.model,
  effort: a.effort,
  autoEdits: a.autoEdits,
})

export interface NewRepo {
  path: string
  name?: string
  accent?: string
}

interface LoungeState {
  bots: Bot[]
  theme: Theme
  view: View
  selectedId: string | null
  reducedMotion: boolean
  /** Ambient sound + chimes (off until the user turns it on). */
  sound: boolean
  /** Whether the local server (and so every repo agent) is reachable. */
  connection: Connection
  activity: Record<string, ActivityLine[]>
  chats: Record<string, Message[]>
  /** What each run changed in the repo, per bot. */
  changes: Record<string, Change[]>
  /** Steps waiting for your Allow / Deny, per bot. */
  permissions: Record<string, PermissionRequest[]>
  /** Stats of the last finished run, per bot. */
  runs: Record<string, AgentRun>
  // actions
  setView(v: View): void
  toggleTheme(): void
  toggleSound(): void
  selectBot(id: string | null): void
  sendChat(botId: string, text: string): void
  answerPermission(botId: string, requestId: string, allow: boolean): void
  stopAgent(botId: string): void
  setAgentOptions(botId: string, patch: { model?: string; effort?: string; autoEdits?: boolean }): void
  resetAgentSession(botId: string): void
  addRepo(input: NewRepo): Promise<{ botId: string } | { error: string }>
  removeRepo(botId: string): Promise<string | null>
  suggestRepos(): Promise<RepoSuggestion[]>
}

const Ctx = createContext<LoungeState | null>(null)

export function LoungeProvider({ children }: { children: ReactNode }) {
  const reducedMotion = usePrefersReducedMotion()

  // Restored bots start idle: nothing is running until the server says so.
  const [bots, setBots] = useState<Bot[]>(() => (SAVED?.bots ?? []).map((b) => ({ ...b, status: 'idle' })))
  const [view, setView] = useState<View>('lounge')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [connection, setConnection] = useState<Connection>('connecting')
  const [activity, setActivity] = useState<Record<string, ActivityLine[]>>(() => SAVED?.activity ?? {})
  const [chats, setChats] = useState<Record<string, Message[]>>(() => SAVED?.chats ?? {})
  const [changes, setChanges] = useState<Record<string, Change[]>>(() => SAVED?.changes ?? {})
  const [permissions, setPermissions] = useState<Record<string, PermissionRequest[]>>({})
  const [runs, setRuns] = useState<Record<string, AgentRun>>({})
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

  // Live ref so handlers and actions always read the current roster.
  const botsRef = useRef(bots)
  botsRef.current = bots

  // Persist what the room accumulates (debounced; theme and sound have their
  // own keys).
  useEffect(() => {
    const id = setTimeout(() => {
      try {
        const state: SavedState = { bots, activity, chats, changes }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
      } catch {
        /* storage full/blocked — persistence is best-effort */
      }
    }, 400)
    return () => clearTimeout(id)
  }, [bots, activity, chats, changes])

  // --- the link to the server (created once) ---------------------------------
  const handlersRef = useRef<LinkHandlers | null>(null)
  if (!handlersRef.current) {
    handlersRef.current = {
      onConnection: (state) => {
        setConnection(state)
        if (state !== 'offline') return
        // Nothing runs while the server is down: no one is working or waiting.
        setPermissions((prev) => (Object.keys(prev).length ? {} : prev))
        setBots((prev) => (prev.some((b) => b.status !== 'idle') ? prev.map((b) => ({ ...b, status: 'idle' })) : prev))
      },
      onRoster: (agents, full) => {
        setBots((prev) => {
          let next = full ? prev.filter((b) => agents.some((a) => agentBotId(a.id) === b.id)) : prev
          for (const a of agents) {
            const id = agentBotId(a.id)
            const existing = next.find((b) => b.id === id)
            if (existing) {
              next = next.map((b) =>
                b.id === id
                  ? {
                      ...b,
                      name: a.name,
                      accent: a.accent,
                      blurb: a.blurb,
                      agent: linkOf(a),
                      status: a.status === 'idle' && b.status === 'done' ? b.status : a.status,
                    }
                  : b,
              )
            } else {
              sceneBus.markEntering(id) // a new repo bot walks in through the door
              next = [
                ...next,
                {
                  id,
                  name: a.name,
                  accent: a.accent,
                  blurb: a.blurb,
                  seat: firstOpenSeat(next) % SEATS.length,
                  status: a.status,
                  task: a.lastRun?.prompt ?? `Ready in ${a.repo}`,
                  agent: linkOf(a),
                },
              ]
            }
          }
          return next
        })
      },
      onRemoved: (botId) => {
        setBots((prev) => prev.filter((b) => b.id !== botId))
        setSelectedId((cur) => (cur === botId ? null : cur))
        setActivity((prev) => without(prev, botId))
        setChats((prev) => without(prev, botId))
        setChanges((prev) => without(prev, botId))
        setPermissions((prev) => without(prev, botId))
        setRuns((prev) => without(prev, botId))
      },
      onStatus: (botId, patch) => {
        if (patch.status === 'done') {
          const bot = botsRef.current.find((b) => b.id === botId)
          // Its final answer is already in the speech bubble; just celebrate.
          if (bot && bot.status !== 'done') sceneBus.emit({ type: 'celebrate', botId })
        }
        setBots((prev) => prev.map((b) => (b.id === botId ? { ...b, ...patch } : b)))
      },
      onActivity: (line) =>
        setActivity((prev) => {
          const list = [...(prev[line.botId] ?? []), line].slice(-ACTIVITY_CAP)
          return { ...prev, [line.botId]: list }
        }),
      onChat: (botId, message) => {
        if (message.from !== 'user') {
          const text = message.text.trim()
          if (text) sceneBus.emit({ type: 'say', botId, id: message.id, text })
          else sceneBus.emit({ type: 'typing', botId })
        }
        setChats((prev) => ({ ...prev, [botId]: upsert(prev[botId] ?? [], message) }))
      },
      onChanges: (change) =>
        setChanges((prev) => ({
          ...prev,
          [change.botId]: [...(prev[change.botId] ?? []).filter((c) => c.id !== change.id), change].slice(
            -CHANGES_CAP,
          ),
        })),
      onPermission: (botId, pending) => {
        setPermissions((prev) => ({ ...prev, [botId]: pending }))
        const first = pending[0]
        if (first) {
          sceneBus.emit({ type: 'attention', botId })
          const ask =
            first.tool === 'Bash'
              ? `May I run: ${first.detail}`
              : `May I ${first.summary.charAt(0).toLowerCase()}${first.summary.slice(1)}?`
          sceneBus.emit({ type: 'say', botId, id: first.requestId, text: ask })
        }
      },
      onRun: (botId, run) => setRuns((prev) => ({ ...prev, [botId]: run })),
    }
  }
  const linkRef = useRef<RepoAgentLink | null>(null)
  if (!linkRef.current) linkRef.current = new RepoAgentLink(handlersRef.current)

  useEffect(() => {
    const link = linkRef.current!
    link.start()
    return () => link.stop()
  }, [])

  // A pending Allow / Deny shows in the tab title, so you notice from another tab.
  const pendingCount = Object.values(permissions).reduce((n, l) => n + l.length, 0)
  useEffect(() => {
    document.title = pendingCount ? `(${pendingCount}) AI Lounge` : 'AI Lounge'
  }, [pendingCount])

  // --- actions --------------------------------------------------------------
  const toggleTheme = useCallback(
    () => setTheme((t) => (t === 'light' ? 'dark' : 'light')),
    [],
  )
  // Toggled from a click, so the effect above may start the audio context.
  const toggleSound = useCallback(() => setSound((on) => !on), [])

  const selectBot = useCallback((id: string | null) => setSelectedId(id), [])

  /** A note from the lounge itself in a bot's feed (not something it did). */
  const note = useCallback((botId: string, text: string, kind: ActivityLine['kind'] = 'info') => {
    handlersRef.current!.onActivity({ id: uid('act'), botId, text, kind, at: Date.now() })
  }, [])

  const sendChat = useCallback((botId: string, text: string) => {
    const trimmed = text.trim()
    const bot = botsRef.current.find((b) => b.id === botId)
    if (!trimmed || !bot) return
    const msg: Message = { id: uid('u'), from: 'user', text: trimmed, at: Date.now() }
    setChats((prev) => ({ ...prev, [botId]: upsert(prev[botId] ?? [], msg) }))
    sceneBus.emit({ type: 'typing', botId }) // the bot "composes" its reply
    // A real run in the repo; its reply streams back over the link.
    void linkRef.current!.send(botId, trimmed, { model: bot.agent.model, effort: bot.agent.effort }).then((err) => {
      if (!err) return
      handlersRef.current!.onChat(botId, { id: uid('sys'), from: botId, text: err, at: Date.now() })
    })
  }, [])

  const answerPermission = useCallback((botId: string, requestId: string, allow: boolean) => {
    linkRef.current!.answer(botId, requestId, allow)
  }, [])

  const stopAgent = useCallback((botId: string) => linkRef.current!.stopRun(botId), [])

  // A fresh session forgets the conversation, so the thread is cleared too —
  // otherwise the chat would show context the bot no longer has.
  const resetAgentSession = useCallback(
    (botId: string) => {
      void linkRef.current!.reset(botId).then((err) => {
        if (err) return note(botId, `Couldn't start a new session: ${err}`, 'thought')
        setChats((prev) => without(prev, botId))
        note(botId, 'New session: previous conversation forgotten')
      })
    },
    [note],
  )

  const setAgentOptions = useCallback(
    (botId: string, patch: { model?: string; effort?: string; autoEdits?: boolean }) => {
      setBots((prev) => prev.map((b) => (b.id === botId ? { ...b, agent: { ...b.agent, ...patch } } : b)))
      linkRef.current!.settings(botId, patch)
    },
    [],
  )

  const addRepo = useCallback((input: NewRepo) => linkRef.current!.add(input), [])
  const removeRepo = useCallback((botId: string) => linkRef.current!.remove(botId), [])
  const suggestRepos = useCallback(() => linkRef.current!.suggest(), [])

  const value = useMemo<LoungeState>(
    () => ({
      bots,
      theme,
      view,
      selectedId,
      reducedMotion,
      sound,
      connection,
      activity,
      chats,
      changes,
      permissions,
      runs,
      setView,
      toggleTheme,
      toggleSound,
      selectBot,
      sendChat,
      answerPermission,
      stopAgent,
      setAgentOptions,
      resetAgentSession,
      addRepo,
      removeRepo,
      suggestRepos,
    }),
    [
      bots,
      theme,
      view,
      selectedId,
      reducedMotion,
      sound,
      connection,
      activity,
      chats,
      changes,
      permissions,
      runs,
      toggleTheme,
      toggleSound,
      selectBot,
      sendChat,
      answerPermission,
      stopAgent,
      setAgentOptions,
      resetAgentSession,
      addRepo,
      removeRepo,
      suggestRepos,
    ],
  )

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useLounge(): LoungeState {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useLounge must be used within LoungeProvider')
  return ctx
}
