import { useEffect, useMemo, useRef, useState } from 'react'
import type { Bot, Message } from '../types'
import { Avatar } from './Avatar'
import { TypeLine } from './TypeLine'
import { ArrowUp } from './icons'
import { fmtTime } from '../util'

// A message list + composer, shared by the 1:1 bot panel and the group channel.
// `showAuthors` labels each bot bubble (needed in group, redundant in 1:1).
export function ChatThread({
  messages,
  bots,
  onSend,
  reducedMotion,
  placeholder = 'Message…',
  showAuthors = false,
  suggestions,
}: {
  messages: Message[]
  bots: Bot[]
  onSend: (text: string) => void
  reducedMotion: boolean
  placeholder?: string
  showAuthors?: boolean
  suggestions?: string[]
}) {
  const [text, setText] = useState('')
  const listRef = useRef<HTMLDivElement>(null)
  const byId = useMemo(() => new Map(bots.map((b) => [b.id, b])), [bots])

  useEffect(() => {
    const el = listRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    const t = text.trim()
    if (!t) return
    onSend(t)
    setText('')
  }

  return (
    <div className="chat">
      <div className="chat__list" ref={listRef}>
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
          const animate = !reducedMotion && !mine && i === messages.length - 1
          return (
            <div className="msg" data-mine={mine || undefined} key={m.id}>
              {!mine &&
                (bot ? (
                  <Avatar bot={bot} size={30} />
                ) : (
                  <span className="avatar avatar--ghost" aria-hidden />
                ))}
              <div className="msg__body">
                {showAuthors && !mine && (
                  <span className="msg__author" style={{ color: bot?.accent }}>
                    {bot?.name ?? 'Bot'}
                  </span>
                )}
                <div
                  className="bubble"
                  style={bot ? ({ '--a': bot.accent } as React.CSSProperties) : undefined}
                >
                  <TypeLine text={m.text} animate={animate} />
                </div>
                <span className="msg__time">{fmtTime(m.at)}</span>
              </div>
            </div>
          )
        })}
      </div>
      <form className="composer" onSubmit={submit}>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
        />
        <button type="submit" className="send-btn" disabled={!text.trim()} aria-label="Send message">
          <ArrowUp size={19} strokeWidth={2.6} />
        </button>
      </form>
    </div>
  )
}
