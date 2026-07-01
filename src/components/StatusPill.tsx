import type { Status } from '../types'

export const STATUS_META: Record<Status, { label: string; live: boolean }> = {
  working: { label: 'Working', live: true },
  thinking: { label: 'Thinking', live: true },
  idle: { label: 'Idle', live: false },
  done: { label: 'Done', live: false },
}

// The floating "what am I doing" pill. `live` statuses get a pulsing dot.
export function StatusPill({
  status,
  floating = false,
}: {
  status: Status
  floating?: boolean
}) {
  const meta = STATUS_META[status]
  return (
    <span className="pill" data-status={status} data-floating={floating || undefined}>
      <span className="pill__dot" data-live={meta.live || undefined} />
      {meta.label}
      {status === 'working' || status === 'thinking' ? '…' : ''}
      {status === 'done' ? ' ✓' : ''}
    </span>
  )
}
