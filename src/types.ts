// ---------------------------------------------------------------------------
// Core domain types for AI Lounge.
// A "bot" is one AI agent that lives in the lounge. Everything the UI renders —
// avatars, status pills, activity feeds, chats — is derived from these.
// ---------------------------------------------------------------------------

export type Role =
  | 'engineer'
  | 'researcher'
  | 'designer'
  | 'writer'
  | 'analyst'
  | 'coordinator'

// What a bot is doing right now. Drives the status pill + progress.
export type Status = 'working' | 'thinking' | 'idle' | 'done'

export interface Bot {
  id: string
  name: string
  role: Role
  /** Per-bot identity color (hex). The app also has one global accent. */
  accent: string
  /** One-line personality blurb. */
  blurb: string
  /** Where the bot sits in the isometric room (seat index into SEATS). */
  seat: number
  // --- live, simulation-driven fields ---
  status: Status
  /** Short label of the current task, e.g. "Refactoring auth service". */
  task: string
  /** 0–100 progress on the current task. */
  progress: number
}

/** A single streamed line in a bot's activity feed. */
export interface ActivityLine {
  id: string
  botId: string
  text: string
  at: number
  /** Semantic flavor for coloring the log line. */
  kind: 'info' | 'action' | 'result' | 'thought'
}

/** A chat message, used for both 1:1 threads and the group channel. */
export interface Message {
  id: string
  /** Author: a bot id, or 'user' for the human. */
  from: string
  text: string
  at: number
  /** True while the newest message is still "typing out". */
  streaming?: boolean
}

export type View = 'lounge' | 'dashboard' | 'group'
export type Theme = 'light' | 'dark'
