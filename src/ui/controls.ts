export interface Pt { x: number; y: number }

export interface Handle { id: string; pos: Pt; radius: number }

export const hitTest = (handles: Handle[], p: Pt): string | null => {
  let best: string | null = null
  let bestD = Infinity
  for (const h of handles) {
    const d = Math.hypot(h.pos.x - p.x, h.pos.y - p.y)
    if (d <= h.radius && d < bestD) { best = h.id; bestD = d }
  }
  return best
}

const DRAG_THRESHOLD = 4

export const attachDrag = (
  canvas: HTMLCanvasElement,
  getHandles: () => Handle[],
  onDrag: (id: string, screenPos: Pt) => void,
  onTapEmpty?: (screenPos: Pt) => void,
  onTapHandle?: (id: string) => void,
): void => {
  let pressed: string | null = null
  let start: Pt | null = null
  let isDrag = false
  let rafId: number | null = null
  let pending: Pt | null = null

  const local = (ev: PointerEvent): Pt => {
    const r = canvas.getBoundingClientRect()
    return { x: ev.clientX - r.left, y: ev.clientY - r.top }
  }

  const flush = () => {
    rafId = null
    if (!canvas.isConnected) return
    if (pressed && pending) onDrag(pressed, pending)
  }

  const reset = () => {
    pressed = null; start = null; isDrag = false; pending = null
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
    canvas.style.cursor = 'default'
  }

  canvas.addEventListener('pointerdown', (ev) => {
    const p = local(ev)
    pressed = hitTest(getHandles(), p)
    start = p
    isDrag = false
    canvas.setPointerCapture(ev.pointerId)
  })

  canvas.addEventListener('pointermove', (ev) => {
    const p = local(ev)
    if (!start) {
      canvas.style.cursor = hitTest(getHandles(), p) ? 'grab' : 'default'
      return
    }
    if (!isDrag) {
      const moved = Math.hypot(p.x - start.x, p.y - start.y)
      if (moved <= DRAG_THRESHOLD) return
      isDrag = true
      if (pressed) canvas.style.cursor = 'grabbing'
    }
    if (pressed) {
      pending = p
      if (rafId === null) rafId = requestAnimationFrame(flush)
    }
  })

  canvas.addEventListener('pointerup', (ev) => {
    if (!isDrag) {
      if (pressed) onTapHandle?.(pressed)
      else onTapEmpty?.(local(ev))
    }
    reset()
  })

  canvas.addEventListener('pointercancel', () => { reset() })
}

// divergence-strip scrub: the whole canvas is the target (no handles), so
// pointerdown scrubs immediately and every captured pointermove scrubs again,
// coalesced to one onScrub per frame like attachDrag's flush
export const attachTimelineScrub = (
  canvas: HTMLCanvasElement, onScrub: (frac: number) => void,
): void => {
  let active = false
  let rafId: number | null = null
  let pending: number | null = null

  // null when the canvas has no width (e.g. detached/unmounted, or a layout
  // pass that hasn't run yet): dividing by a zero width would yield NaN,
  // which store.setT would pass straight through as playback.t
  const fracOf = (ev: PointerEvent): number | null => {
    const r = canvas.getBoundingClientRect()
    if (r.width <= 0) return null
    return Math.min(1, Math.max(0, (ev.clientX - r.left) / r.width))
  }

  const flush = () => {
    rafId = null
    if (!canvas.isConnected) return
    if (pending !== null) onScrub(pending)
    pending = null
  }

  canvas.style.cursor = 'ew-resize'

  canvas.addEventListener('pointerdown', (ev) => {
    active = true
    // setPointerCapture throws (NotFoundError) for a pointerId with no
    // browser-tracked active pointer (e.g. synthetic events); capture is an
    // enhancement for drags that leave the canvas, so a failure here must
    // never block the scrub itself
    try { canvas.setPointerCapture(ev.pointerId) } catch { /* no active pointer to capture */ }
    const f = fracOf(ev)
    if (f !== null) onScrub(f)
  })

  canvas.addEventListener('pointermove', (ev) => {
    if (!active) return
    const f = fracOf(ev)
    if (f === null) return
    pending = f
    if (rafId === null) rafId = requestAnimationFrame(flush)
  })

  const release = (): void => {
    active = false
    pending = null
    if (rafId !== null) { cancelAnimationFrame(rafId); rafId = null }
  }
  canvas.addEventListener('pointerup', release)
  canvas.addEventListener('pointercancel', release)
}

export interface ControlRow { el: HTMLElement; refresh: () => void }

export const sliderRow = (
  label: string, min: number, max: number, step: number,
  get: () => number, set: (val: number) => void,
): ControlRow => {
  const wrap = document.createElement('div')
  const lab = document.createElement('label')
  lab.textContent = label
  const row = document.createElement('div')
  row.className = 'row'
  const range = document.createElement('input')
  range.type = 'range'
  range.min = String(min); range.max = String(max); range.step = String(step)
  const text = document.createElement('input')
  text.type = 'text'
  const refresh = () => {
    if (document.activeElement !== range) range.value = String(get())
    if (document.activeElement !== text) text.value = String(get())
  }
  range.addEventListener('input', () => { set(Number(range.value)) })
  let editing = false
  text.addEventListener('input', () => { editing = true })
  const commit = () => {
    const v = editedCommit(editing, text.value, min, max)
    if (v !== null) set(v)
    editing = false
    refresh()
  }
  text.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') commit() })
  text.addEventListener('blur', commit)
  refresh()
  wrap.append(lab, row)
  row.append(range, text)
  return { el: wrap, refresh }
}

export const buttonRow = (labels: string[], onClick: (i: number) => void): HTMLElement => {
  const row = document.createElement('div')
  row.className = 'row'
  labels.forEach((l, i) => {
    const b = document.createElement('button')
    b.textContent = l
    b.addEventListener('click', () => onClick(i))
    row.appendChild(b)
  })
  return row
}

export const numCommit = (raw: string, min: number, max: number): number | null => {
  if (raw.trim() === '') return null
  const n = Number(raw)
  if (!Number.isFinite(n)) return null
  return Math.min(max, Math.max(min, n))
}

// blur without a prior input event is not an edit: never commit (would round
// the displayed value into the true value on a mere focus-then-blur)
export const editedCommit = (editing: boolean, raw: string, min: number, max: number): number | null =>
  editing ? numCommit(raw, min, max) : null

export const numRow = (
  label: string, get: () => number, set: (v: number) => void,
  opts: { min: number; max: number; digits?: number },
): ControlRow => {
  const digits = opts.digits ?? 2
  const wrap = document.createElement('div')
  const lab = document.createElement('label')
  lab.textContent = label
  const row = document.createElement('div')
  row.className = 'row'
  const text = document.createElement('input')
  text.type = 'text'
  let focused = false
  let editing = false
  const show = () => { text.value = get().toFixed(digits) }
  const refresh = () => { if (!focused && !editing) show() }
  text.addEventListener('focus', () => { focused = true })
  text.addEventListener('input', () => { editing = true })
  text.addEventListener('blur', () => {
    focused = false
    const v = editedCommit(editing, text.value, opts.min, opts.max)
    if (v !== null) set(v)
    editing = false
    show()
  })
  text.addEventListener('keydown', (ev) => { if (ev.key === 'Enter') text.blur() })
  show()
  wrap.append(lab, row)
  row.appendChild(text)
  return { el: wrap, refresh }
}
