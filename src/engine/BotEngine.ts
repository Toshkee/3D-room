import type { ActivityLine, Artifact, Bot, Message, Status } from '../types'

// ---------------------------------------------------------------------------
// The seam between the simulation and the UI.
//
// The provider owns React state and passes an engine these handlers. The engine
// pushes updates through them; it never touches React directly. Swapping the
// SimulatedBotEngine for a real ClaudeBotEngine later means implementing this
// same interface — the UI doesn't change.
// ---------------------------------------------------------------------------

export type StatusPatch = Partial<Pick<Bot, 'status' | 'task' | 'progress'>> & {
  status?: Status
}

export interface EngineHandlers {
  /** A new line for a bot's activity feed. */
  onActivity(line: ActivityLine): void
  /** Patch a bot's live status/task/progress. */
  onStatus(botId: string, patch: StatusPatch): void
  /**
   * A bot's reply in its 1:1 thread. UPSERT semantics: if a message with the
   * same id already exists, its content is replaced (streaming engines send
   * the same message repeatedly as it grows).
   */
  onChat(botId: string, message: Message): void
  /** A message in the shared group channel (from a bot). Same upsert semantics. */
  onGroup(message: Message): void
  /** A bot finished an assigned brief and produced a deliverable. */
  onArtifact(artifact: Artifact): void
}

export interface BotEngine {
  /** Begin autonomous activity + group chatter. */
  start(): void
  /** Stop all timers. */
  stop(): void
  /** User sent a 1:1 message to a bot; produce a reply. */
  sendChat(botId: string, text: string): void
  /** User posted in the group channel; produce bot reactions. */
  sendGroup(text: string): void
  /** User assigned the bot a brief; produce a real deliverable (artifact). */
  assignTask(botId: string, brief: string): void
}
