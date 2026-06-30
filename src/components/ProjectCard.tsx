import { useEffect, useRef, useState } from 'react'
import type { Project } from '../data/projects'

type CardProps = {
  project: Project | null
  onClose: () => void
}

/**
 * The slide-up info panel. It stays mounted (so it can animate out) and keeps
 * rendering the last project's content while sliding away.
 */
export function ProjectCard({ project, onClose }: CardProps) {
  const open = project !== null
  // Retain the last shown project so the card keeps its content during the
  // slide-out transition instead of going blank.
  const [shown, setShown] = useState<Project | null>(project)
  const cardRef = useRef<HTMLDivElement>(null)
  const lastFocused = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (project) setShown(project)
  }, [project])

  // Move focus into the card on open and restore it to the trigger on close.
  useEffect(() => {
    if (open) {
      lastFocused.current = document.activeElement as HTMLElement | null
      cardRef.current?.focus({ preventScroll: true })
    } else {
      lastFocused.current?.focus?.({ preventScroll: true })
      lastFocused.current = null
    }
  }, [open])

  // Close on Escape for keyboard users.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  const data = project ?? shown
  const canOpen = !!data?.link && !data?.add

  return (
    <div className="card-dock">
      {/* Polite live region: announces the open project (incl. when the user
          switches projects while the card stays open). Outside the card so it's
          never `inert`. */}
      <div className="sr-only" role="status" aria-live="polite">
        {open && data ? `${data.name}, ${data.tag}` : ''}
      </div>
      <div
        ref={cardRef}
        className={`card${open ? ' open' : ''}`}
        style={data ? { ['--accent' as string]: data.css } : undefined}
        role="dialog"
        aria-modal="false"
        // `inert` (React 19) removes the closed card from the tab order AND the
        // a11y tree, and blurs any focused descendant — no aria-hidden focus trap.
        inert={!open}
        tabIndex={-1}
        aria-label={data ? `${data.name} — ${data.tag}` : undefined}
      >
        {data && (
          <>
            <div className="card-head">
              <span className="card-chip" aria-hidden="true">
                {data.glyph ?? '◆'}
              </span>
              <div className="card-titles">
                <h2>{data.name}</h2>
                <div className="tag">{data.tag}</div>
              </div>
              <button
                type="button"
                className="card-close"
                onClick={onClose}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            {!data.add && (
              <div className="card-media">
                <img
                  key={data.id}
                  src={`${import.meta.env.BASE_URL}previews/${data.id}.jpg`}
                  alt={`${data.name} preview`}
                  loading="lazy"
                  // Hide gracefully if a project has no generated preview yet.
                  onError={(e) => {
                    e.currentTarget.style.display = 'none'
                  }}
                />
              </div>
            )}

            <p className="card-blurb">{data.blurb}</p>

            <div className="card-actions">
              {data.add ? (
                <span className="soon">Reserved for the next build ✦</span>
              ) : canOpen ? (
                <a
                  className="btn-open"
                  href={data.link}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Open project <span className="arrow">→</span>
                </a>
              ) : (
                <span className="soon">Link coming soon ✦</span>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  )
}
