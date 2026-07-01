import { useEffect, useState } from 'react'
import { clamp } from '../util'

// Types `text` out character-by-character on mount when `animate` is true;
// otherwise shows it whole. Since callers key each line/message by id, the
// component mounts once per line, so only genuinely-new content animates.
export function TypeLine({ text, animate }: { text: string; animate: boolean }) {
  const [shown, setShown] = useState(animate ? '' : text)

  useEffect(() => {
    if (!animate) {
      setShown(text)
      return
    }
    let i = 0
    setShown('')
    const speed = clamp(650 / Math.max(text.length, 1), 12, 42)
    const id = setInterval(() => {
      i += 1
      setShown(text.slice(0, i))
      if (i >= text.length) clearInterval(id)
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
