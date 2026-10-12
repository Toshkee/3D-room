import { useEffect, useState } from 'react'
import { useSpeech } from '../state/sceneBus'

const MAX = 92

// Plain-text, single-thought version of a chat message for a bubble: strip
// light markdown, keep the first ~90 characters.
function clip(text: string): string {
  // Drop markdown emphasis/code marks and heading/quote markers, but keep
  // single underscores (file names like LOUNGE_TEST.md).
  const t = text
    .replace(/\*\*|__|`/g, '')
    .replace(/(^|\n)\s*[#>]+\s*/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  if (t.length <= MAX) return t
  const cut = t.slice(0, MAX)
  const sp = cut.lastIndexOf(' ')
  return `${cut.slice(0, sp > 60 ? sp : MAX).trimEnd()}…`
}

// A comic-style speech bubble above a bot's head: what it just said in the
// team channel or to you (streams in as the reply grows), or typing dots while
// it composes. Pops in, lingers a few seconds (longer for longer lines), fades.
// Decorative — the same text is in the chat views — so it's aria-hidden.
export function SpeechBubble({ botId }: { botId: string }) {
  const s = useSpeech(botId)
  const [phase, setPhase] = useState<'off' | 'on' | 'leaving'>('off')

  useEffect(() => {
    if (!s) return
    const life = s.typing ? 14000 : Math.min(9500, 3800 + s.text.length * 45)
    const left = life - (Date.now() - s.at)
    if (left <= 0) {
      setPhase('off')
      return
    }
    setPhase('on')
    const t1 = setTimeout(() => setPhase('leaving'), Math.max(0, left - 260))
    const t2 = setTimeout(() => setPhase('off'), left)
    return () => {
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [s])

  if (!s || phase === 'off') return null
  const text = s.typing ? '' : clip(s.text)
  if (!s.typing && !text) return null
  return (
    <div
      key={s.id}
      className="speech"
      data-typing={s.typing || undefined}
      data-leaving={phase === 'leaving' || undefined}
      aria-hidden
    >
      {s.typing ? (
        <span className="speech__dots">
          <i />
          <i />
          <i />
        </span>
      ) : (
        <span className="speech__text">{text}</span>
      )}
    </div>
  )
}
