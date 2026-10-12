import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Change, ChangedFile } from '../types'
import { Check, Copy, X } from './icons'
import { fmtTime } from '../util'

/** The files a run touched, with +/- line counts. */
export function ChangedFiles({ files }: { files: ChangedFile[] }) {
  return (
    <ul className="change__files">
      {files.map((f) => (
        <li key={f.path} className="change__file">
          <span className="change__path" title={f.path}>
            {f.path}
          </span>
          {f.kind !== 'edit' && <span className="change__kind">{f.kind}</span>}
          {f.add != null && f.add > 0 && <span className="change__add">+{f.add}</span>}
          {f.del != null && f.del > 0 && <span className="change__del">−{f.del}</span>}
        </li>
      ))}
    </ul>
  )
}

// A run's full diff in a wide dialog — the side panel is too narrow to read
// code in. Portaled to <body>: the panel's backdrop-filter would otherwise
// trap this fixed overlay inside it. Escape closes only this dialog.
export function DiffModal({ change, onClose }: { change: Change; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const [copied, setCopied] = useState(false)

  const closeRef = useRef(onClose)
  closeRef.current = onClose
  useEffect(() => {
    const back = document.activeElement as HTMLElement | null
    ref.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation() // capture phase: the panel's Escape handler never sees it
      closeRef.current()
    }
    window.addEventListener('keydown', onKey, true)
    return () => {
      window.removeEventListener('keydown', onKey, true)
      back?.focus()
    }
  }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(change.diff)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      /* clipboard blocked — nothing to do */
    }
  }

  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal--wide"
        role="dialog"
        aria-modal="true"
        aria-label="Changes"
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="modal__head">
          <div className="diffview__title">
            <h2>Changes</h2>
            <span>{fmtTime(change.at)}</span>
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <p className="diffview__prompt">{change.prompt}</p>
        <ChangedFiles files={change.files} />
        <div className="change__diffwrap">
          <button type="button" className="change__copy" onClick={copy}>
            {copied ? <Check size={13} strokeWidth={2.6} /> : <Copy size={13} strokeWidth={2.2} />}
            {copied ? 'Copied' : 'Copy diff'}
          </button>
          <pre className="change__diff">
            {change.diff.split('\n').map((line, i) => (
              <span key={i} className="diffline" data-k={diffKind(line)}>
                {line}
              </span>
            ))}
          </pre>
        </div>
      </div>
    </div>,
    document.body,
  )
}

function diffKind(line: string): string | undefined {
  if (/^(\+\+\+|---|diff |index |new file|deleted file|similarity|rename )/.test(line)) return 'meta'
  if (line.startsWith('@@')) return 'hunk'
  if (line.startsWith('+')) return 'add'
  if (line.startsWith('-')) return 'del'
  return undefined
}
