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
  for (const s of [0.25, 0.5, 1, 2]) {
    const o = document.createElement('option')
    o.value = String(s); o.textContent = s + 'x'
    speed.appendChild(o)
  }
  speed.value = '1'
  let scrubbing = false
  play.addEventListener('click', () => store.setPlaying(!store.get().playback.playing))
  reset.addEventListener('click', () => { store.setPlaying(false); store.setT(0) })
  scrub.addEventListener('pointerdown', () => { scrubbing = true })
  scrub.addEventListener('pointerup', () => { scrubbing = false })
  scrub.addEventListener('pointercancel', () => { scrubbing = false })
  scrub.addEventListener('input', () => { store.setPlaying(false); store.setT(Number(scrub.value)) })
  speed.addEventListener('change', () => store.setSpeed(Number(speed.value)))
  el.append(play, reset, scrub, speed)
  const render = () => {
    const s = store.get()
    play.textContent = s.playback.playing ? 'Pause' : 'Play'
    scrub.max = String(duration(s.ensemble.reference))
    if (!scrubbing) scrub.value = String(s.playback.t)
  }
  return { el, render }
}
