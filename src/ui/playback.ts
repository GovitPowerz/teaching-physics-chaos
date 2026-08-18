import { duration } from '../sim/simulate'
import type { Store } from '../state'

export const createPlayback = (store: Store) => {
  const el = document.createElement('div')
  el.className = 'row'
  const play = document.createElement('button')
  const reset = document.createElement('button')
  reset.textContent = 'Reset'
  const scrub = document.createElement('input')
  scrub.type = 'range'
  scrub.min = '0'; scrub.step = '0.01'
  const speed = document.createElement('select')
  for (const s of [0.25, 0.5, 1, 2, 4, 8, 16]) {
    const o = document.createElement('option')
    o.value = String(s); o.textContent = s + 'x'
    speed.appendChild(o)
  }
  speed.value = '1'
  let scrubbing = false
  // capture intent at pointerdown: it fires BEFORE a focused text field's
  // blur, whose commit can rebuild the ensemble and reset playing to false
  // mid-gesture - a blind toggle at click time would then RESTART playback
  // on a click that meant pause.
  // act on pointerup, not click: while playing, the rAF loop used to rewrite
  // this button's label every frame, and WebKit does not synthesize a click
  // when the DOM under the pointer mutates between press and release - the
  // pause press animated but never fired. click remains only as the keyboard
  // path (Space/Enter produce a click with no pointer events).
  let intentPause: boolean | null = null
  let pointerHandled = false
  const act = () => {
    const s = store.get()
    const pause = intentPause ?? s.playback.playing
    intentPause = null
    if (pause) { store.setPlaying(false); return }
    if (s.playback.t >= duration(s.ensemble.reference)) store.setT(0)
    store.setPlaying(true)
  }
  play.addEventListener('pointerdown', () => { intentPause = store.get().playback.playing })
  play.addEventListener('pointerup', () => {
    pointerHandled = true
    setTimeout(() => { pointerHandled = false }, 0)
    act()
  })
  play.addEventListener('click', () => {
    if (pointerHandled) { pointerHandled = false; return }
    act()
  })
  reset.addEventListener('click', () => { store.setPlaying(false); store.setT(0) })
  scrub.addEventListener('pointerdown', () => { scrubbing = true })
  scrub.addEventListener('pointerup', () => { scrubbing = false })
  scrub.addEventListener('pointercancel', () => { scrubbing = false })
  scrub.addEventListener('input', () => { store.setPlaying(false); store.setT(Number(scrub.value)) })
  speed.addEventListener('change', () => store.setSpeed(Number(speed.value)))
  el.append(play, reset, scrub, speed)
  const render = () => {
    const s = store.get()
    // idempotent writes: assigning textContent replaces the text node even
    // when the string is unchanged, and the rAF loop renders every frame
    // during playback - constant node churn under the pointer is what broke
    // WebKit's click synthesis on this button in the first place
    const label = s.playback.playing ? 'Pause' : 'Play'
    if (play.textContent !== label) play.textContent = label
    const max = String(duration(s.ensemble.reference))
    if (scrub.max !== max) scrub.max = max
    if (!scrubbing) scrub.value = String(s.playback.t)
  }
  return { el, render }
}
