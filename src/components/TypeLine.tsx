import { useEffect, useRef, useState } from 'react'

/** Characters per 20 ms tick: quick on long text, gentle near the end. */
const step = (left: number) => Math.max(1, Math.ceil(left / 18))

// Types `text` out when `animate` is true; otherwise returns it whole.
// Append-aware: if `text` grows (streamed messages), typing continues from
// where it was instead of restarting — only a genuinely different text resets.
// Long texts speed up, so even a big answer is out in about two seconds.
export function useTyped(text: string, animate: boolean): string {
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
    const id = setInterval(() => {
      const cur = shownRef.current
      if (cur.length >= text.length) return
      setShown(text.slice(0, cur.length + step(text.length - cur.length)))
    }, 20)
    return () => clearInterval(id)
  }, [text, animate])

  return animate ? shown : text
}

export function TypeLine({ text, animate }: { text: string; animate: boolean }) {
  const shown = useTyped(text, animate)
  const typing = animate && shown.length < text.length
  return (
    <>
      {shown}
      {typing && <span className="caret" aria-hidden />}
    </>
  )
}
