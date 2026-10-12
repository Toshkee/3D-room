import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Bot, Change, Message } from '../types'
import { Avatar } from './Avatar'
import { useTyped } from './TypeLine'
import { Markdown } from './Markdown'
import { LineCounts, changeTotals } from './DiffModal'
import { ArrowUp, FileDiff } from './icons'
import { fmtTime } from '../util'

// A bot's message list + composer (in the BotPanel). Empty threads offer a
// few starter prompts so you never face a blank box. A reply whose run changed
// files carries a "View diff" chip. The composer grows with what you type
// (Enter sends, Shift+Enter adds a line); while `blocked` is set it keeps your
// draft but won't send, and says why.
export function ChatThread({
  messages,
  bots,
  onSend,
  reducedMotion,
  placeholder = 'Message…',
  suggestions,
  blocked,
  changes,
  onViewChange,
}: {
  messages: Message[]
  bots: Bot[]
  onSend: (text: string) => void
  reducedMotion: boolean
  placeholder?: string
  suggestions?: string[]
  blocked?: string | null
  /** Runs that changed files; a reply with the same id gets a diff chip. */
  changes?: Change[]
  onViewChange?: (change: Change) => void
}) {
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const areaRef = useRef<HTMLTextAreaElement>(null)
  const byId = useMemo(() => new Map(bots.map((b) => [b.id, b])), [bots])
  const changeById = useMemo(() => new Map((changes ?? []).map((c) => [c.id, c])), [changes])

  // Follow both new messages and streamed growth of the newest one.
  const lastLen = messages.length ? messages[messages.length - 1].text.length : 0
  const pinned = useRef(true)
  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, lastLen])
  // Stay on the newest message while the list shrinks (the Changes section
  // appears, the composer grows) or a reply types itself out — unless you
  // scrolled up to read.
  useEffect(() => {
    const el = listRef.current
    if (!el) return
    const follow = () => {
      if (pinned.current) el.scrollTop = el.scrollHeight
    }
    const ro = new ResizeObserver(follow)
    ro.observe(el)
    const mo = new MutationObserver(follow)
    mo.observe(el, { childList: true, subtree: true, characterData: true })
    return () => {
      ro.disconnect()
      mo.disconnect()
    }
  }, [])
  const onScroll = () => {
    const el = listRef.current
    if (el) pinned.current = el.scrollHeight - el.scrollTop - el.clientHeight < 48
  }

  // Fit the box to its text; CSS max-height caps it and it scrolls past that.
  useLayoutEffect(() => {
    const el = areaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [text])

  const canSend = Boolean(text.trim()) && !blocked
  const send = () => {
    if (!canSend) return
    onSend(text.trim())
    setText('')
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    send()
  }
  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key !== 'Enter' || e.shiftKey || e.nativeEvent.isComposing) return
    e.preventDefault()
    send()
  }

  return (
    <div className="chat">
      <div className="chat__list" ref={listRef} onScroll={onScroll}>
        {messages.length === 0 && (
          <div className="chat__empty">
            <p className="feed__empty">
              {suggestions && suggestions.length > 0
                ? 'No messages yet — try one of these:'
                : 'No messages yet — say hi 👋'}
            </p>
            {suggestions && suggestions.length > 0 && (
              <div className="suggestions">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    type="button"
                    className="suggestion"
                    disabled={Boolean(blocked)}
                    onClick={() => onSend(s)}
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
        {messages.map((m, i) => {
          const mine = m.from === 'user'
          const bot = mine ? null : byId.get(m.from)
          const last = i === messages.length - 1
          const animate = !reducedMotion && !mine && last
          // A reply that hasn't produced text yet: typing dots while the bot
          // is busy, nothing once it isn't.
          const pending = !mine && !m.text
          if (pending && !(last && (bot?.status === 'working' || bot?.status === 'waiting'))) return null
          return (
            <div className="msg" data-mine={mine || undefined} key={m.id}>
              {!mine && (bot ? <Avatar bot={bot} size={30} /> : <span className="avatar avatar--ghost" aria-hidden />)}
              <div className="msg__body">
                <div className="bubble" style={bot ? ({ '--a': bot.accent } as React.CSSProperties) : undefined}>
                  {pending ? (
                    <span className="bubble__dots" role="img" aria-label={`${bot?.name ?? 'Bot'} is replying`}>
                      <i />
                      <i />
                      <i />
                    </span>
                  ) : mine ? (
                    m.text
                  ) : (
                    <Reply text={m.text} animate={animate} />
                  )}
                </div>
                {!mine && changeById.has(m.id) && onViewChange && (
                  <DiffChip change={changeById.get(m.id)!} onView={onViewChange} />
                )}
                <span className="msg__time">{fmtTime(m.at)}</span>
              </div>
            </div>
          )
        })}
      </div>
      <form className="composer" onSubmit={submit} data-blocked={blocked ? true : undefined}>
        <textarea
          ref={areaRef}
          rows={2}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          aria-label={placeholder}
          aria-describedby="composer-hint"
        />
        <div className="composer__foot">
          <span className="composer__hint" id="composer-hint">
            {blocked ?? (
              <>
                <kbd>Enter</kbd> to send · <kbd>Shift</kbd>+<kbd>Enter</kbd> new line
              </>
            )}
          </span>
          <button type="submit" className="send-btn" disabled={!canSend} aria-label="Send message">
            <ArrowUp size={18} strokeWidth={2.6} />
          </button>
        </div>
      </form>
    </div>
  )
}

function DiffChip({ change, onView }: { change: Change; onView: (c: Change) => void }) {
  const n = change.files.length
  const t = changeTotals(change.files)
  return (
    <button type="button" className="diff-chip" onClick={() => onView(change)}>
      <FileDiff size={13} strokeWidth={2.4} />
      <span>
        {n} file{n === 1 ? '' : 's'} changed
      </span>
      <LineCounts add={t.add} del={t.del} />
      <span className="diff-chip__go">View diff</span>
    </button>
  )
}

// A bot's answer, formatted, typing itself out when it's the newest one.
function Reply({ text, animate }: { text: string; animate: boolean }) {
  const shown = useTyped(text, animate)
  return (
    <>
      <Markdown text={shown} />
      {animate && shown.length < text.length && <span className="caret" aria-hidden />}
    </>
  )
}
