import type { Bot } from '../types'
import { RobotFace } from './RobotFace'

// A circular framed robot portrait — the 2D echo of the in-scene bots.
export function Avatar({
  bot,
  size = 48,
  selected = false,
}: {
  bot: Pick<Bot, 'accent' | 'role' | 'name'>
  size?: number
  selected?: boolean
}) {
  return (
    <span
      className="avatar"
      data-selected={selected || undefined}
      style={{ '--a': bot.accent, width: size, height: size } as React.CSSProperties}
      aria-hidden
    >
      <RobotFace accent={bot.accent} size={Math.round(size * 0.9)} />
    </span>
  )
}
