import { useEffect, useRef, useState } from 'react'
import { clamp } from '../util'

// Types `text` out character-by-character when `animate` is true; otherwise
// shows it whole. Append-aware: if `text` grows (streamed messages), typing
// continues from where it was instead of restarting — only a genuinely
// different text resets the animation.
export function TypeLine({ text, animate }: { text: string; animate: boolean }) {
  const [shown, setShown] = useState(animate ? '' : text)
  const shownRef = useRef(shown)
  shownRef.current = shown

  useEffect(() => {
    if (!animate) {
      setShown(text)
      return
    }
    // Restart only if the new text isn't a continuation of what's displayed.
    if (!text.startsWith(shownRef.current)) {
      shownRef.current = ''
      setShown('')
    }
    const speed = clamp(650 / Math.max(text.length, 1), 12, 42)
    const id = setInterval(() => {
      const cur = shownRef.current
      if (cur.length >= text.length) return
      setShown(text.slice(0, cur.length + 1))
    }, speed)
    return () => clearInterval(id)
  }, [text, animate])

  const typing = animate && shown.length < text.length
  return (
    <>
      {shown}
      {typing && <span className="caret" aria-hidden />}
    </>
  )
}
