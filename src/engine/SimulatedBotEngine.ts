import type { Bot, Message } from '../types'
import type { BotEngine, EngineHandlers } from './BotEngine'
import {
  ACTIVITY,
  GROUP,
  GROUP_TO_USER,
  REPLY,
  REPLY_GENERIC,
  TASKS,
  chance,
  keyword,
  pick,
} from './content'

let seq = 0
const uid = (p: string) => `${p}-${++seq}`

// A believable, self-contained simulation of a team of AI bots working and
// talking. Timers drive the whole thing; the getBots() accessor keeps it in
// sync with the live roster (including imported bots) without holding a stale copy.
export class SimulatedBotEngine implements BotEngine {
  private timers: ReturnType<typeof setTimeout>[] = []
  private lastGroupSpeaker: string | null = null
  private getBots: () => Bot[]
  private h: EngineHandlers

  constructor(getBots: () => Bot[], handlers: EngineHandlers) {
    this.getBots = getBots
    this.h = handlers
  }

  start() {
    this.timers.push(setInterval(() => this.activityTick(), 1700))
    this.timers.push(setInterval(() => this.progressTick(), 2600))
    this.timers.push(setInterval(() => this.groupTick(), 9000))
  }

  stop() {
    this.timers.forEach(clearInterval)
    this.timers = []
  }

  // --- autonomous loops ----------------------------------------------------

  private activityTick() {
    const bots = this.getBots()
    if (!bots.length) return
    // Prefer a bot that's actually doing something; otherwise wake someone.
    const busy = bots.filter((b) => b.status === 'working' || b.status === 'thinking')
    const bot = busy.length ? pick(busy) : pick(bots)
    if (bot.status === 'idle' && chance(0.5)) {
      this.h.onStatus(bot.id, { status: chance(0.5) ? 'working' : 'thinking' })
    }
    const line = pick(ACTIVITY[bot.role])
    this.h.onActivity({
      id: uid('act'),
      botId: bot.id,
      text: line.text,
      kind: line.kind,
      at: Date.now(),
    })
  }

  private progressTick() {
    const bots = this.getBots()
    for (const bot of bots) {
      // Occasional mood changes keep the room from feeling scripted.
      if (chance(0.08)) {
        const next = pick(['working', 'thinking', 'idle'] as const)
        if (next !== bot.status) this.h.onStatus(bot.id, { status: next })
      }
      if (bot.status !== 'working') continue
      const p = bot.progress + 4 + Math.floor(Math.random() * 9)
      if (p >= 100) {
        // Finish, celebrate, then pick up something new.
        this.h.onStatus(bot.id, { status: 'done', progress: 100 })
        this.h.onActivity({
          id: uid('act'),
          botId: bot.id,
          text: `Done: ${bot.task} ✓`,
          kind: 'result',
          at: Date.now(),
        })
        this.after(2600, () => {
          const next = pick(TASKS[bot.role].filter((t) => t !== bot.task))
          this.h.onStatus(bot.id, { status: 'working', task: next, progress: 3 })
          this.h.onActivity({
            id: uid('act'),
            botId: bot.id,
            text: `Starting: ${next}`,
            kind: 'info',
            at: Date.now(),
          })
        })
      } else {
        this.h.onStatus(bot.id, { progress: p })
      }
    }
  }

  private groupTick() {
    const bots = this.getBots()
    if (bots.length < 2) return
    // Avoid the same bot speaking twice in a row.
    const speaker =
      pick(bots.filter((b) => b.id !== this.lastGroupSpeaker)) ?? pick(bots)
    this.lastGroupSpeaker = speaker.id
    const options = GROUP.filter((g) => !g.role || g.role === speaker.role)
    const tmpl = options.length ? pick(options) : pick(GROUP)
    let text = tmpl.text
    if (tmpl.mentions) {
      const others = bots.filter((b) => b.id !== speaker.id)
      text = text.replace('{other}', others.length ? pick(others).name : 'team')
    }
    this.h.onGroup({ id: uid('grp'), from: speaker.id, text, at: Date.now(), streaming: true })
  }

  // --- user-initiated ------------------------------------------------------

  sendChat(botId: string, text: string) {
    const bot = this.getBots().find((b) => b.id === botId)
    if (!bot) return
    this.h.onStatus(botId, { status: 'thinking' })
    const kw = keyword(text)
    const body = kw
      ? pick(REPLY[bot.role]).replace(/\{kw\}/g, kw)
      : pick(REPLY_GENERIC)
    this.after(700 + Math.random() * 900, () => {
      this.h.onChat(botId, this.msg(botId, body))
      this.h.onStatus(botId, { status: 'working' })
    })
  }

  assignTask(botId: string, brief: string) {
    const bot = this.getBots().find((b) => b.id === botId)
    if (!bot) return
    const shortTask = brief.length > 64 ? `${brief.slice(0, 61)}…` : brief
    this.h.onStatus(botId, { status: 'working', task: shortTask, progress: 10 })
    this.after(2600 + Math.random() * 2000, () => {
      this.h.onArtifact({
        id: uid('art'),
        botId,
        title: brief,
        content:
          '(simulated) This is where the real deliverable would go — start the Claude proxy (`npm run server`) and reassign to get actual output.',
        at: Date.now(),
      })
      this.h.onStatus(botId, { status: 'done', progress: 100 })
    })
  }

  sendGroup(text: string) {
    const bots = this.getBots()
    if (!bots.length) return
    const kw = keyword(text)
    // One or two relevant bots chime in, staggered.
    const responders = shuffle(bots).slice(0, chance(0.5) ? 2 : 1)
    responders.forEach((bot, i) => {
      const base = pick(GROUP_TO_USER)
      const body = kw && chance(0.5) ? `${base} (on ${kw})` : base
      this.after(900 + i * 1400 + Math.random() * 600, () => {
        this.h.onGroup(this.msg(bot.id, body))
      })
    })
  }

  // --- helpers -------------------------------------------------------------

  private msg(from: string, text: string): Message {
    return { id: uid('msg'), from, text, at: Date.now(), streaming: true }
  }

  private after(ms: number, fn: () => void) {
    this.timers.push(setTimeout(fn, ms))
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
