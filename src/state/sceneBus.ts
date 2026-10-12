import { useSyncExternalStore } from 'react'

// ---------------------------------------------------------------------------
// Scene cues — the ephemeral "something just happened" signals the 3D room and
// the sound layer react to: a bot speaking or typing a reply (speech bubbles),
// finishing a run (celebration), needing your OK (attention), a bot typing at a
// desk (keyboard sounds), and a newly added repo's bot walking in the door.
//
// This is NOT app state: nothing here is persisted or rendered by the DOM
// views. LoungeContext (and the scene itself) emit; BotAvatar and the audio
// layer subscribe. Keeping it outside React means a
// streaming reply only re-renders that one bot's bubble, not the whole canvas.
// ---------------------------------------------------------------------------

export type Cue =
  /** A bot said something. Same id re-emitted as text streams in. */
  | { type: 'say'; botId: string; id: string; text: string }
  /** A bot is composing a reply — show the typing dots. */
  | { type: 'typing'; botId: string }
  /** A bot finished a run. */
  | { type: 'celebrate'; botId: string }
  /** A bot needs your Allow / Deny. */
  | { type: 'attention'; botId: string }

export interface Speech {
  id: string
  text: string
  typing: boolean
  at: number
}

const speech = new Map<string, Speech>()
const speechSubs = new Map<string, Set<() => void>>()
const cueSubs = new Set<(c: Cue) => void>()
const entering = new Map<string, number>()
const keys = new Set<string>()
const keySubs = new Set<(count: number) => void>()

function notifySpeech(botId: string) {
  speechSubs.get(botId)?.forEach((fn) => fn())
}

export const sceneBus = {
  emit(c: Cue) {
    if (c.type === 'say') {
      speech.set(c.botId, { id: c.id, text: c.text, typing: false, at: Date.now() })
      notifySpeech(c.botId)
    } else if (c.type === 'typing') {
      const cur = speech.get(c.botId)
      speech.set(c.botId, { id: cur?.id ?? `t-${Date.now()}`, text: '', typing: true, at: Date.now() })
      notifySpeech(c.botId)
    }
    cueSubs.forEach((fn) => fn(c))
  },

  onCue(fn: (c: Cue) => void): () => void {
    cueSubs.add(fn)
    return () => cueSubs.delete(fn)
  },

  speech(botId: string): Speech | undefined {
    return speech.get(botId)
  },

  subscribeSpeech(botId: string, fn: () => void): () => void {
    let set = speechSubs.get(botId)
    if (!set) speechSubs.set(botId, (set = new Set()))
    set.add(fn)
    return () => set!.delete(fn)
  },

  /**
   * A newly added bot should walk in through the door instead of popping in.
   * Not consumed on read (StrictMode mounts effects twice in dev); the mark
   * simply expires, so a later remount of the room doesn't replay it.
   */
  markEntering(botId: string) {
    entering.set(botId, Date.now())
  },
  isEntering(botId: string): boolean {
    const at = entering.get(botId)
    if (at == null) return false
    if (Date.now() - at > 4000) {
      entering.delete(botId)
      return false
    }
    return true
  },

  /** A bot started/stopped typing at a desk or laptop (drives keyboard sounds). */
  setKeys(botId: string, on: boolean) {
    const had = keys.has(botId)
    if (on === had) return
    if (on) keys.add(botId)
    else keys.delete(botId)
    keySubs.forEach((fn) => fn(keys.size))
  },
  onKeys(fn: (count: number) => void): () => void {
    keySubs.add(fn)
    return () => keySubs.delete(fn)
  },
}

/** The latest thing a bot said (or its typing state), for its speech bubble. */
export function useSpeech(botId: string): Speech | undefined {
  return useSyncExternalStore(
    (fn) => sceneBus.subscribeSpeech(botId, fn),
    () => sceneBus.speech(botId),
  )
}
