export function ProgressBar({ value, accent }: { value: number; accent: string }) {
  const v = Math.max(0, Math.min(100, Math.round(value)))
  return (
    <div className="progress" role="progressbar" aria-valuenow={v} aria-valuemin={0} aria-valuemax={100}>
      <span className="progress__fill" style={{ width: `${v}%`, background: accent }} />
    </div>
  )
}
