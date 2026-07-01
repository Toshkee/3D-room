import { useEffect, useRef, useState } from 'react'
import { useLounge } from '../state/LoungeContext'
import { ACCENT_SWATCHES, ROLES, ROLE_META } from '../theme'
import type { Role } from '../types'
import { Avatar } from './Avatar'
import { ROLE_ICON, X } from './icons'

// The "import a bot" flow: name, role, accent, personality. Adds the bot to the
// lounge (it walks straight into an open seat) and drops you back in the room.
export function ImportBotModal({ onClose }: { onClose: () => void }) {
  const { addBot, setView, selectBot } = useLounge()
  const [name, setName] = useState('')
  const [role, setRole] = useState<Role>('engineer')
  const [accent, setAccent] = useState(ROLE_META.engineer.accent)
  const [blurb, setBlurb] = useState('')
  const nameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    nameRef.current?.focus()
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const chooseRole = (r: Role) => {
    setRole(r)
    setAccent(ROLE_META[r].accent)
  }

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      nameRef.current?.focus()
      return
    }
    const bot = addBot({ name, role, accent, blurb })
    onClose()
    setView('lounge')
    selectBot(bot.id)
  }

  const preview = { name: name.trim() || 'New bot', role, accent }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Import a bot"
        onClick={(e) => e.stopPropagation()}
        style={{ '--a': accent } as React.CSSProperties}
      >
        <header className="modal__head">
          <h2>Import a bot</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="modal__preview">
          <Avatar bot={preview} size={64} />
          <div>
            <div className="modal__preview-name">{preview.name}</div>
            <div className="modal__preview-role">{ROLE_META[role].label}</div>
          </div>
        </div>

        <form className="form" onSubmit={submit}>
          <label className="field">
            <span>Name</span>
            <input
              ref={nameRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Orion"
              maxLength={24}
            />
          </label>

          <div className="field">
            <span>Role</span>
            <div className="role-grid">
              {ROLES.map((r) => {
                const Icon = ROLE_ICON[r]
                return (
                  <button
                    type="button"
                    key={r}
                    className="role-chip"
                    data-active={r === role || undefined}
                    onClick={() => chooseRole(r)}
                  >
                    <Icon size={20} strokeWidth={2.2} />
                    {ROLE_META[r].label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="field">
            <span>Accent</span>
            <div className="swatches">
              {ACCENT_SWATCHES.map((c) => (
                <button
                  type="button"
                  key={c}
                  className="swatch"
                  data-active={c === accent || undefined}
                  style={{ background: c }}
                  onClick={() => setAccent(c)}
                  aria-label={`Accent ${c}`}
                />
              ))}
            </div>
          </div>

          <label className="field">
            <span>Personality</span>
            <textarea
              value={blurb}
              onChange={(e) => setBlurb(e.target.value)}
              placeholder="One line — how does this bot work?"
              rows={2}
              maxLength={120}
            />
          </label>

          <div className="form__actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--accent">
              Add to lounge
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
