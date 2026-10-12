import { useEffect, useRef, useState } from 'react'
import { useLounge } from '../state/LoungeContext'
import type { RepoSuggestion } from '../engine/RepoAgentLink'
import { ACCENT_SWATCHES } from '../theme'
import { Avatar } from './Avatar'
import { FolderGit2, X } from './icons'

const baseName = (p: string) => p.replace(/\/+$/, '').split('/').pop() ?? ''

// "Add a repo": pick a project folder (git repos found under ~ are offered as
// one-click suggestions), name the bot, pick its color. The server writes it
// to lounge.agents.json and the new bot walks in through the door.
export function AddRepoModal({ onClose }: { onClose: () => void }) {
  const { bots, connection, addRepo, suggestRepos, setView, selectBot } = useLounge()
  const [repoPath, setRepoPath] = useState('')
  const [name, setName] = useState('')
  const [nameTouched, setNameTouched] = useState(false)
  const [accent, setAccent] = useState(() => {
    const used = new Set(bots.map((b) => b.accent))
    return ACCENT_SWATCHES.find((c) => !used.has(c)) ?? ACCENT_SWATCHES[0]
  })
  const [suggestions, setSuggestions] = useState<RepoSuggestion[] | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const pathRef = useRef<HTMLInputElement>(null)
  const offline = connection === 'offline'

  // Focus the first field once, on open only (see the focus-steal note in
  // BotPanel: never key this to values that change while you type).
  useEffect(() => {
    pathRef.current?.focus()
  }, [])

  useEffect(() => {
    let live = true
    void suggestRepos().then((list) => live && setSuggestions(list))
    return () => {
      live = false
    }
  }, [suggestRepos, connection])

  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && closeRef.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const choosePath = (p: string) => {
    setRepoPath(p)
    setError('')
    if (!nameTouched) setName(baseName(p).slice(0, 24))
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!repoPath.trim()) {
      pathRef.current?.focus()
      return
    }
    setBusy(true)
    setError('')
    const out = await addRepo({ path: repoPath.trim(), name: name.trim() || undefined, accent })
    setBusy(false)
    if ('error' in out) {
      setError(out.error)
      return
    }
    onClose()
    setView('lounge')
    selectBot(out.botId)
  }

  const preview = { name: name.trim() || baseName(repoPath) || 'New bot', accent }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal"
        role="dialog"
        aria-modal="true"
        aria-label="Add a repo"
        onClick={(e) => e.stopPropagation()}
        style={{ '--a': accent } as React.CSSProperties}
      >
        <header className="modal__head">
          <h2>Add a repo</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>

        <div className="modal__preview">
          <Avatar bot={preview} size={64} />
          <div>
            <div className="modal__preview-name">{preview.name}</div>
            <div className="modal__preview-sub">
              Works in {repoPath.trim() || 'your repo'} with Claude Code, and asks before it edits files or runs
              commands.
            </div>
          </div>
        </div>

        {offline && (
          <p className="modal__note" role="status">
            The lounge server isn't running. Start it with <code>npm run server</code>, then add the repo.
          </p>
        )}

        <form className="form" onSubmit={submit}>
          {suggestions && suggestions.length > 0 && (
            <div className="field">
              <span>Found on this Mac</span>
              <div className="repo-picks">
                {suggestions.map((s) => (
                  <button
                    type="button"
                    key={s.path}
                    className="repo-pick"
                    data-active={s.path === repoPath || undefined}
                    onClick={() => choosePath(s.path)}
                    title={s.path}
                  >
                    <FolderGit2 size={14} strokeWidth={2.3} />
                    <span className="repo-pick__name">{s.name}</span>
                    <span className="repo-pick__path">{s.path}</span>
                  </button>
                ))}
              </div>
            </div>
          )}

          <label className="field">
            <span>Folder</span>
            <input
              ref={pathRef}
              value={repoPath}
              onChange={(e) => choosePath(e.target.value)}
              placeholder="~/Projects/my-app"
              spellCheck={false}
              autoCapitalize="off"
              autoComplete="off"
            />
          </label>

          <label className="field">
            <span>Bot name</span>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value)
                setNameTouched(true)
              }}
              placeholder={baseName(repoPath) || 'e.g. Oblun'}
              maxLength={24}
            />
          </label>

          <div className="field">
            <span>Color</span>
            <div className="swatches">
              {ACCENT_SWATCHES.map((c) => (
                <button
                  type="button"
                  key={c}
                  className="swatch"
                  data-active={c === accent || undefined}
                  style={{ background: c, color: c }}
                  onClick={() => setAccent(c)}
                  aria-label={`Color ${c}`}
                  aria-pressed={c === accent}
                />
              ))}
            </div>
          </div>

          {error && (
            <p className="form__error" role="alert">
              {error}
            </p>
          )}

          <div className="form__actions">
            <button type="button" className="btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn--accent" disabled={busy || offline || !repoPath.trim()}>
              {busy ? 'Adding…' : 'Add to lounge'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
