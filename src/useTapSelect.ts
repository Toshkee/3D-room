import { useRef, useState } from 'react'
import type { ThreeEvent } from '@react-three/fiber'

// tap-vs-drag guard: a press that moves too far (or lasts too long) is a camera
// drag, not a selection. Touch gets a more generous slop than a mouse.
const TAP_PX = 9
const TAP_PX_TOUCH = 16
const TAP_MS = 500

/**
 * Pointer handlers + hover state for a selectable spot in the scene. Spreads
 * onto the invisible hit proxy mesh. Shared by `Person` and `Battlestation`
 * so tap/drag behavior (and the hover cursor) stays identical everywhere.
 */
export function useTapSelect(id: string, onSelect: (id: string) => void) {
  const [hovered, setHovered] = useState(false)
  const down = useRef<{ x: number; y: number; t: number; touch: boolean } | null>(null)

  const onPointerDown = (e: ThreeEvent<PointerEvent>) => {
    down.current = { x: e.clientX, y: e.clientY, t: e.timeStamp, touch: e.pointerType !== 'mouse' }
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    const d = down.current
    down.current = null
    if (!d) return
    const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y)
    if (moved > (d.touch ? TAP_PX_TOUCH : TAP_PX) || e.timeStamp - d.t > TAP_MS) return
    e.stopPropagation()
    onSelect(id)
  }
  const onPointerOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHovered(true)
    // Only a real mouse gets the pointer cursor — touch/pen often fire no
    // matching pointerout, which would otherwise leave a hybrid device's cursor
    // stuck as a hand after a tap.
    if (e.pointerType === 'mouse') document.body.style.cursor = 'pointer'
  }
  const onPointerOut = () => {
    setHovered(false)
    document.body.style.cursor = 'auto'
  }

  return { hovered, handlers: { onPointerDown, onClick, onPointerOver, onPointerOut } }
}
