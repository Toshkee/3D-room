import {
  Wrench,
  FlaskConical,
  Palette,
  PenLine,
  BarChart3,
  Compass,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '../types'

// Consistent SVG role icons (Lucide) — replaces emoji glyphs across the UI.
export const ROLE_ICON: Record<Role, LucideIcon> = {
  engineer: Wrench,
  researcher: FlaskConical,
  designer: Palette,
  writer: PenLine,
  analyst: BarChart3,
  coordinator: Compass,
}

export {
  Moon,
  Sun,
  Plus,
  X,
  ArrowUp,
  Gamepad2,
  LayoutGrid,
  MessagesSquare,
  Sparkles,
  Copy,
  Check,
  Package,
  RotateCcw,
} from 'lucide-react'
