// ---------------------------------------------------------------------------
// Core domain types for AI Lounge.
// A "bot" is one repo on this Mac with a real Claude Code session behind it.
// Everything the UI renders — avatars, status pills, activity feeds, chats,
// changes — is derived from these.
// ---------------------------------------------------------------------------

// What a bot is doing right now. Drives the status pill and where it goes in
// the room. `waiting` = blocked on your Allow / Deny.
export type Status = 'working' | 'thinking' | 'idle' | 'done' | 'waiting'

/** A bot bound to a real git repo, driven by Claude Code via the local server. */
export interface RepoLink {
  /** Agent id in lounge.agents.json. */
  id: string
  /** Repo folder name, e.g. "Oblun". */
  repo: string
  /** Where it lives, e.g. "~/Oblun". */
  path: string
  model: string
  effort: string
  /** File edits run without asking. */
  autoEdits: boolean
}

/** A step a repo agent wants to take that needs your OK. */
export interface PermissionRequest {
  requestId: string
  agentId: string
  tool: string
  summary: string
  detail: string
  at: number
}

/** Stats of a repo agent's last finished run. */
export interface AgentRun {
  ok: boolean
  turns: number | null
  durationMs: number
  costUsd: number | null
  tools: number
  denied: number
  /** Files the run changed (absent on runs saved before this was tracked). */
  files?: number
  /** The message that started it, clipped. */
  prompt?: string
  at: number
}

export interface Bot {
  id: string
  name: string
  /** Per-bot identity color (hex). The app also has one global accent. */
  accent: string
  /** Optional one-line note from lounge.agents.json. */
  blurb: string
  /** Where the bot sits in the isometric room (seat index into SEATS). */
  seat: number
  // --- live fields ---
  status: Status
  /** The current (or last) thing you asked it to do. */
  task: string
  /** The repo and the Claude Code settings behind this bot. */
  agent: RepoLink
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

/** A chat message in a bot's thread. */
export interface Message {
  id: string
  /** Author: a bot id, or 'user' for the human. */
  from: string
  text: string
  at: number
  /** True while the newest message is still "typing out". */
  streaming?: boolean
}

/** One file a run touched. `add`/`del` are line counts (null when unknown). */
export interface ChangedFile {
  path: string
  kind: 'edit' | 'new' | 'deleted'
  add: number | null
  del: number | null
}

/** What one run changed in the repo: the files, the diff, and its answer. */
export interface Change {
  id: string
  botId: string
  /** The message that started the run. */
  prompt: string
  /** The bot's final answer. */
  summary: string
  files: ChangedFile[]
  diff: string
  at: number
}

/** Is the local server (the repo agents) reachable? */
export type Connection = 'connecting' | 'online' | 'offline'

export type View = 'lounge' | 'dashboard'
export type Theme = 'light' | 'dark'
