import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Change, ChangedFile } from '../types'
import { Check, Copy, X } from './icons'
import { fmtTime } from '../util'

/** Lines added / removed across a run's files (binary files count as 0). */
export function changeTotals(files: ChangedFile[]) {
  return files.reduce((t, f) => ({ add: t.add + (f.add ?? 0), del: t.del + (f.del ?? 0) }), { add: 0, del: 0 })
}

/** "+12 −3" in diff colors; nothing for a side that's zero. */
export function LineCounts({ add, del }: { add: number | null; del: number | null }) {
  return (
    <>
      {add != null && add > 0 && <span className="lc lc--add">+{add}</span>}
      {del != null && del > 0 && <span className="lc lc--del">−{del}</span>}
    </>
  )
}

// A run's full diff in a wide dialog — the side panel is too narrow to read
// code in. One section per file (sticky header, old/new line numbers), git's
// own bookkeeping lines hidden. Portaled to <body>: the panel's
// backdrop-filter would otherwise trap this fixed overlay inside it. Escape
// closes only this dialog.
export function DiffModal({ change, onClose }: { change: Change; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)
  const sections = useRef<(HTMLElement | null)[]>([])
  const [copied, setCopied] = useState(false)
  const parsed = useMemo(() => parseDiff(change.diff), [change.diff])
  const stats = useMemo(() => new Map(change.files.map((f) => [f.path, f])), [change.files])
  const total = changeTotals(change.files)

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

  const n = change.files.length
  return createPortal(
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal modal--diff"
        role="dialog"
        aria-modal="true"
        aria-label="Changes"
        tabIndex={-1}
        ref={ref}
        onClick={(e) => e.stopPropagation()}
      >
        <header className="diffview__head">
          <div className="diffview__title">
            <h2>Changes</h2>
            <span>
              {n} file{n === 1 ? '' : 's'} · <LineCounts add={total.add} del={total.del} /> · {fmtTime(change.at)}
            </span>
          </div>
          <button type="button" className="chip-btn" onClick={copy}>
            {copied ? <Check size={13} strokeWidth={2.6} /> : <Copy size={13} strokeWidth={2.2} />}
            {copied ? 'Copied' : 'Copy diff'}
          </button>
          <button className="icon-btn" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </header>
        <p className="diffview__prompt">{change.prompt}</p>
        {parsed.length > 1 && (
          <nav className="diffview__files" aria-label="Files">
            {parsed.map((f, i) => (
              <button
                key={f.path}
                type="button"
                className="dchip"
                onClick={() =>
                  sections.current[i]?.scrollIntoView({
                    block: 'start',
                    behavior: 'smooth',
                  })
                }
              >
                <span className="dchip__path">{f.path}</span>
                <LineCounts add={stats.get(f.path)?.add ?? null} del={stats.get(f.path)?.del ?? null} />
              </button>
            ))}
          </nav>
        )}
        <div className="diffview__body">
          {parsed.length === 0 && <p className="feed__empty">No diff to show.</p>}
          {parsed.map((f, i) => {
            const st = stats.get(f.path)
            return (
              <section
                className="dfile"
                key={f.path}
                ref={(el) => {
                  sections.current[i] = el
                }}
              >
                <header className="dfile__head">
                  <span className="dfile__path">{f.path}</span>
                  {st && st.kind !== 'edit' && <span className="dfile__kind">{st.kind}</span>}
                  <LineCounts add={st?.add ?? null} del={st?.del ?? null} />
                </header>
                <div className="dfile__rows">
                  <div className="dfile__table">
                    {f.rows.map((r, j) =>
                      r.k === 'hunk' || r.k === 'note' ? (
                        <div key={j} className="drow" data-k={r.k}>
                          {r.text}
                        </div>
                      ) : (
                        <div key={j} className="drow" data-k={r.k}>
                          <span className="drow__n">{r.a ?? ''}</span>
                          <span className="drow__n">{r.b ?? ''}</span>
                          <span className="drow__code">
                            <span className="drow__sign" aria-hidden>
                              {r.k === 'add' ? '+' : r.k === 'del' ? '−' : ' '}
                            </span>
                            {r.text}
                          </span>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </section>
            )
          })}
        </div>
      </div>
    </div>,
    document.body,
  )
}

interface Row {
  k: 'add' | 'del' | 'ctx' | 'hunk' | 'note'
  text: string
  /** Line number in the old / new file. */
  a?: number
  b?: number
}
interface FileDiff {
  path: string
  rows: Row[]
}

// The server's diff is `git diff <base>` chunks plus pseudo-chunks for new
// untracked files ("new file <path>" followed by "+" lines).
function parseDiff(diff: string): FileDiff[] {
  const files: FileDiff[] = []
  let cur: FileDiff | null = null
  let a = 0
  let b = 0
  let inHunk = false
  for (const line of diff.split('\n')) {
    let m = line.match(/^diff --git a\/.+? b\/(.+)$/)
    if (m) {
      cur = { path: m[1], rows: [] }
      files.push(cur)
      inHunk = false
      continue
    }
    m = line.match(/^new file (?!mode )(.+?)( \(binary or large, not shown\))?$/)
    if (m) {
      cur = { path: m[1], rows: [] }
      files.push(cur)
      inHunk = true
      a = 0
      b = 1
      if (m[2]) cur.rows.push({ k: 'note', text: 'Binary or large file — not shown' })
      continue
    }
    if (line.startsWith('… (diff truncated)')) {
      cur?.rows.push({
        k: 'note',
        text: 'The rest of this diff was cut off — Copy diff has what was captured.',
      })
      continue
    }
    if (!cur) continue
    m = line.match(/^@@ -(\d+)(?:,\d+)? \+(\d+)(?:,\d+)? @@/)
    if (m) {
      a = Number(m[1])
      b = Number(m[2])
      inHunk = true
      cur.rows.push({ k: 'hunk', text: line })
      continue
    }
    if (!inHunk) {
      // index / --- / +++ / mode lines: bookkeeping, not content.
      if (line.startsWith('Binary files')) cur.rows.push({ k: 'note', text: 'Binary file changed' })
      continue
    }
    if (line.startsWith('+')) cur.rows.push({ k: 'add', text: line.slice(1), b: b++ })
    else if (line.startsWith('-')) cur.rows.push({ k: 'del', text: line.slice(1), a: a++ })
    else if (line.startsWith(' ')) cur.rows.push({ k: 'ctx', text: line.slice(1), a: a++, b: b++ })
    // "\ No newline at end of file" and the blank lines between chunks: skip.
  }
  return files
}
