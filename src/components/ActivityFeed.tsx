import { useEffect, useRef } from 'react'
import type { ActivityLine } from '../types'
import { fmtTime } from '../util'
import { TypeLine } from './TypeLine'

// The streaming log you watch a bot work in. Newest line at the bottom;
// auto-scrolls as lines arrive, and only the newest line types itself out.
export function ActivityFeed({
  lines,
  reducedMotion,
}: {
  lines: ActivityLine[]
  reducedMotion: boolean
}) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = el.scrollHeight
  }, [lines.length])

  return (
    <div className="feed" ref={ref}>
      {lines.length === 0 && <p className="feed__empty">Warming up…</p>}
      {lines.map((l, i) => (
        <div className="feed__line" data-kind={l.kind} key={l.id}>
          <span className="feed__time">{fmtTime(l.at)}</span>
          <span className="feed__dot" aria-hidden />
          <span className="feed__text">
            <TypeLine text={l.text} animate={!reducedMotion && i === lines.length - 1} />
          </span>
        </div>
      ))}
    </div>
  )
}
