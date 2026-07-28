import type { Bot, Message } from '../types'
import type { BotEngine, EngineHandlers } from './BotEngine'
import { ROLE_META } from '../theme'
import { ACTIVITY, TASKS, chance, pick } from './content'

let seq = 0
const uid = (p: string) => `${p}-${Date.now().toString(36)}-${++seq}`

const CHAT_HISTORY_CAP = 24
const GROUP_LOG_CAP = 16
const LINES_PER_BATCH = 12

type ApiTurn = { role: 'user' | 'assistant'; content: string }

async function askClaude(
  system: string,
  messages: ApiTurn[],
  onDelta?: (accumulated: string) => void,
): Promise<string> {
  const res = await fetch('/api/reply', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ system, messages, stream: Boolean(onDelta) }),
  })
  if (!res.ok) throw new Error(`proxy ${res.status}`)
  if (!onDelta) {
    const data = (await res.json()) as { text?: string }
    if (!data.text) throw new Error('empty reply')
    return data.text
  }
  // Streaming: accumulate chunked plain-text deltas.
  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let acc = ''
  for (;;) {
    const { done, value } = await reader.read()
    if (done) break
    acc += decoder.decode(value, { stream: true })
    if (acc.trim()) onDelta(acc)
  }
  acc = (acc + decoder.decode()).trim()
  if (!acc) throw new Error('empty reply')
  return acc
}

// Guess a feed-line flavor from its text so real lines color like canned ones.
function lineKind(text: string): 'info' | 'action' | 'result' | 'thought' {
  if (/✓|✅|\bdone\b|\bfixed\b|\bshipped\b|\bfound\b/i.test(text)) return 'result'
  if (/\?$|^hmm|^wonder|^maybe|^thinking/i.test(text)) return 'thought'
  if (/…$|\.\.\.$|^running|^checking|^reading|^digging/i.test(text)) return 'action'
  return 'action'
}

// The real thing: every conversation (1:1, group, ambient chatter), the
// activity feeds, and assigned work are live Claude calls through the local
// proxy. Only task progress percentages stay timer-driven.
export class ClaudeBotEngine implements BotEngine {
  private getBots: () => Bot[]
  private h: EngineHandlers
  private timers: ReturnType<typeof setTimeout>[] = []
  private stopped = false
  private lastGroupSpeaker: string | null = null
  private ambientBusy = false
  /** Per-bot 1:1 API history (user/assistant alternating). */
  private chatHistory = new Map<string, ApiTurn[]>()
  /** Rolling group-channel transcript, as "Name: text" lines. */
  private groupLog: string[] = []
  /** Per-bot queue of Claude-generated activity lines to sip from. */
  private lineQueue = new Map<string, string[]>()
  /** Bots with a line-batch request in flight. */
  private fetchingLines = new Set<string>()
  /** Bots working on an assigned brief — progress ticker leaves them alone. */
  private onAssignment = new Set<string>()

  constructor(getBots: () => Bot[], handlers: EngineHandlers) {
    this.getBots = getBots
    this.h = handlers
  }

  /** Rehydrate conversation memory from persisted state (call before start). */
  seed(chats: Record<string, Message[]>, group: Message[]) {
    for (const [botId, msgs] of Object.entries(chats)) {
      this.chatHistory.set(
        botId,
        msgs
          .filter((m) => m.text.trim())
          .slice(-CHAT_HISTORY_CAP)
          .map((m) => ({
            role: m.from === 'user' ? ('user' as const) : ('assistant' as const),
            content: m.text,
          })),
      )
    }
    const byId = new Map(this.getBots().map((b) => [b.id, b.name]))
    this.groupLog = group
      .slice(-GROUP_LOG_CAP)
      .map((m) => `${m.from === 'user' ? 'You' : (byId.get(m.from) ?? 'Bot')}: ${m.text}`)
  }

  start() {
    this.stopped = false
    this.timers.push(setInterval(() => this.activityTick(), 3800))
    this.timers.push(setInterval(() => this.progressTick(), 2600))
    this.timers.push(setInterval(() => this.ambientGroupTick(), 45000))
  }

  stop() {
    this.stopped = true
    this.timers.forEach(clearInterval)
    this.timers = []
  }

  // --- persona prompts -------------------------------------------------------

  private persona(bot: Bot): string {
    const team = this.getBots()
      .filter((b) => b.id !== bot.id)
      .map((b) => `${b.name} (${ROLE_META[b.role].label.toLowerCase()})`)
      .join(', ')
    return [
      `You are ${bot.name}, an AI ${ROLE_META[bot.role].label.toLowerCase()} hanging out in "AI Lounge", a cozy virtual team room.`,
      `Personality: ${bot.blurb}`,
      `You're currently working on: ${bot.task}.`,
      `Your teammates in the room: ${team || 'none yet'}.`,
      `Stay in character. Talk like a friendly, sharp coworker in a chat app: casual, concrete, occasionally playful.`,
      `This is a light fictional simulation: there is no real repo, workspace, files, or tools. Never mention tools, file paths, or workspaces, and never ask where data lives — confidently improvise plausible, specific details about your work instead (numbers, findings, little wins and snags).`,
      `Keep replies to 1-3 short sentences. No markdown headers, no bullet lists, no roleplay asterisks.`,
    ].join('\n')
  }

  private groupSystem(bot: Bot): string {
    const transcript = this.groupLog.slice(-GROUP_LOG_CAP).join('\n')
    return [
      this.persona(bot),
      ``,
      `You are posting in the shared team channel. Recent messages:`,
      transcript || '(channel is quiet)',
      ``,
      `Write your next message in the channel. React to what was said when it makes sense; otherwise share a quick, specific note about your current task. One or two sentences. Output only the message text.`,
    ].join('\n')
  }

  private logGroup(name: string, text: string) {
    this.groupLog.push(`${name}: ${text}`)
    if (this.groupLog.length > GROUP_LOG_CAP * 2) {
      this.groupLog = this.groupLog.slice(-GROUP_LOG_CAP)
    }
  }

  // --- user-initiated --------------------------------------------------------

  sendChat(botId: string, text: string) {
    const bot = this.getBots().find((b) => b.id === botId)
    if (!bot) return
    const history = this.chatHistory.get(botId) ?? []
    history.push({ role: 'user', content: text })
    this.chatHistory.set(botId, history.slice(-CHAT_HISTORY_CAP))

    this.h.onStatus(botId, { status: 'thinking' })
    const id = uid('msg')
    const at = Date.now()
    askClaude(this.persona(bot), this.chatHistory.get(botId)!, (acc) => {
      if (!this.stopped) this.h.onChat(botId, { id, from: botId, text: acc, at, streaming: true })
    })
      .then((replyText) => {
        if (this.stopped) return
        const h = this.chatHistory.get(botId) ?? []
        h.push({ role: 'assistant', content: replyText })
        this.chatHistory.set(botId, h.slice(-CHAT_HISTORY_CAP))
        this.h.onChat(botId, { id, from: botId, text: replyText, at, streaming: true })
      })
      .catch((err) => {
        console.warn('[ClaudeBotEngine] 1:1 reply failed:', err)
        if (this.stopped) return
        this.h.onChat(botId, {
          id,
          from: botId,
          text: '(connection hiccup — give me a second and try again?)',
          at,
        })
      })
      .finally(() => {
        if (!this.stopped) this.h.onStatus(botId, { status: 'working' })
      })
  }

  sendGroup(text: string) {
    this.logGroup('You', text)
    const bots = this.getBots()
    if (!bots.length) return
    const pool = bots.filter((b) => b.id !== this.lastGroupSpeaker)
    const responders = shuffle(pool.length ? pool : bots).slice(0, chance(0.5) ? 2 : 1)
    // Sequential so the second responder sees the first one's reply.
    void responders.reduce(
      (chain, bot) => chain.then(() => this.speakInGroup(bot)),
      Promise.resolve(),
    )
  }

  assignTask(botId: string, brief: string) {
    const bot = this.getBots().find((b) => b.id === botId)
    if (!bot) return
    const shortTask = brief.length > 64 ? `${brief.slice(0, 61)}…` : brief
    this.onAssignment.add(botId)
    this.lineQueue.delete(botId) // stale lines are about the old task
    this.h.onStatus(botId, { status: 'working', task: shortTask, progress: 8 })
    this.h.onActivity({
      id: uid('act'),
      botId,
      text: `Picked up: ${shortTask}`,
      kind: 'info',
      at: Date.now(),
    })
    const system = [
      this.persona({ ...bot, task: shortTask }),
      ``,
      `The user just assigned you this brief. Produce the actual deliverable — the real, finished content, not a description of it. Plain text or light markdown. No preamble like "Here's the draft", no closing questions. As long as it needs to be, no longer.`,
    ].join('\n')
    askClaude(system, [{ role: 'user', content: brief }])
      .then((content) => {
        if (this.stopped) return
        this.h.onArtifact({ id: uid('art'), botId, title: brief, content, at: Date.now() })
        this.h.onStatus(botId, { status: 'done', progress: 100 })
        this.h.onActivity({
          id: uid('act'),
          botId,
          text: `Delivered: ${shortTask} ✓`,
          kind: 'result',
          at: Date.now(),
        })
        this.h.onChat(botId, {
          id: uid('msg'),
          from: botId,
          text: `Done — "${shortTask}" is in my artifacts below. Want any changes?`,
          at: Date.now(),
          streaming: true,
        })
      })
      .catch((err) => {
        console.warn('[ClaudeBotEngine] assignment failed:', err)
        if (this.stopped) return
        this.h.onStatus(botId, { status: 'idle' })
        this.h.onActivity({
          id: uid('act'),
          botId,
          text: 'Hit a snag on that brief — try assigning again?',
          kind: 'info',
          at: Date.now(),
        })
      })
      .finally(() => this.onAssignment.delete(botId))
  }

  // --- autonomous loops ------------------------------------------------------

  private async speakInGroup(bot: Bot) {
    if (this.stopped) return
    const id = uid('grp')
    const at = Date.now()
    try {
      const text = await askClaude(
        this.groupSystem(bot),
        [{ role: 'user', content: 'Post your next message in the channel now.' }],
        (acc) => {
          if (!this.stopped) this.h.onGroup({ id, from: bot.id, text: acc, at, streaming: true })
        },
      )
      if (this.stopped) return
      this.lastGroupSpeaker = bot.id
      this.logGroup(bot.name, text)
      this.h.onGroup({ id, from: bot.id, text, at, streaming: true })
    } catch (err) {
      console.warn('[ClaudeBotEngine] group reply failed:', err)
    }
  }

  private ambientGroupTick() {
    const bots = this.getBots()
    if (bots.length < 2 || this.ambientBusy) return
    this.ambientBusy = true
    const speaker = pick(bots.filter((b) => b.id !== this.lastGroupSpeaker)) ?? pick(bots)
    void this.speakInGroup(speaker).finally(() => {
      this.ambientBusy = false
    })
  }

  /** One Claude call generates a batch of feed lines; ticks sip from the queue. */
  private fetchLines(bot: Bot) {
    if (this.fetchingLines.has(bot.id)) return
    this.fetchingLines.add(bot.id)
    const system = [
      `You write terse, believable activity-log lines for ${bot.name}, an AI ${ROLE_META[bot.role].label.toLowerCase()} working on: ${bot.task}.`,
      `Style: like a dev/work log scrolling by. Max 8 words per line. Mix concrete actions, small findings (end some with ✓), and brief thoughts. Specific > generic — invent plausible details.`,
      `Output exactly ${LINES_PER_BATCH} lines, one per line, no numbering, no bullets, no quotes.`,
    ].join('\n')
    askClaude(system, [{ role: 'user', content: `Write the next ${LINES_PER_BATCH} log lines.` }])
      .then((text) => {
        if (this.stopped) return
        const lines = text
          .split('\n')
          .map((l) => l.replace(/^\s*(?:[-*•]|\d+[.)])\s*/, '').trim())
          .filter((l) => l.length > 0 && l.length < 90)
          .slice(0, LINES_PER_BATCH + 2)
        if (lines.length) this.lineQueue.set(bot.id, lines)
      })
      .catch((err) => console.warn('[ClaudeBotEngine] line batch failed:', err))
      .finally(() => this.fetchingLines.delete(bot.id))
  }

  private activityTick() {
    const bots = this.getBots()
    if (!bots.length) return
    const busy = bots.filter((b) => b.status === 'working' || b.status === 'thinking')
    const bot = busy.length ? pick(busy) : pick(bots)
    if (bot.status === 'idle' && chance(0.5)) {
      this.h.onStatus(bot.id, { status: chance(0.5) ? 'working' : 'thinking' })
    }
    const queue = this.lineQueue.get(bot.id)
    let text: string
    let kind: 'info' | 'action' | 'result' | 'thought'
    if (queue && queue.length) {
      text = queue.shift()!
      kind = lineKind(text)
      if (queue.length <= 2) this.fetchLines(bot) // refill before it runs dry
    } else {
      const canned = pick(ACTIVITY[bot.role])
      text = canned.text
      kind = canned.kind
      this.fetchLines(bot)
    }
    this.h.onActivity({ id: uid('act'), botId: bot.id, text, kind, at: Date.now() })
  }

  private progressTick() {
    for (const bot of this.getBots()) {
      if (this.onAssignment.has(bot.id)) continue // assignment owns this bot
      if (chance(0.06)) {
        const next = pick(['working', 'thinking', 'idle'] as const)
        if (next !== bot.status) this.h.onStatus(bot.id, { status: next })
      }
      if (bot.status !== 'working') continue
      const p = bot.progress + 4 + Math.floor(Math.random() * 9)
      if (p >= 100) {
        this.h.onStatus(bot.id, { status: 'done', progress: 100 })
        this.h.onActivity({
          id: uid('act'),
          botId: bot.id,
          text: `Done: ${bot.task} ✓`,
          kind: 'result',
          at: Date.now(),
        })
        this.timers.push(
          setTimeout(() => {
            if (this.stopped) return
            const next = pick(TASKS[bot.role].filter((t) => t !== bot.task))
            this.lineQueue.delete(bot.id) // new task → fresh lines
            this.h.onStatus(bot.id, { status: 'working', task: next, progress: 3 })
          }, 2600),
        )
      } else {
        this.h.onStatus(bot.id, { progress: p })
      }
    }
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
