/** Static overlay header: the title block and the controls hint. */
export function Hud() {
  return (
    <div className="hud-top">
      <div className="brand">
        <h1>Project Room</h1>
        <p>Click a gamer to open their project</p>
      </div>
      <div className="hint">
        <div>
          <kbd>drag</kbd> rotate
        </div>
        <div>
          <kbd>scroll</kbd> / <kbd>pinch</kbd> zoom
        </div>
      </div>
    </div>
  )
}
