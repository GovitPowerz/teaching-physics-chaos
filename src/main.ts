import './style.css'
import { duration } from './sim/simulate'
import { createStore } from './state'
import { createPanel } from './ui/panel'
import { createPlayback } from './ui/playback'
import { createTopbar } from './ui/topbar'

// Interim harness for Task 9 verification: chrome only, no scene renderers.
// Task 14 replaces this file with the full renderer registry and loop.
const store = createStore()

const topbar = createTopbar(store)
document.getElementById('topbar')!.appendChild(topbar.el)
const panel = createPanel(store)
const playback = createPlayback(store)
document.getElementById('panel')!.append(playback.el, panel.el)

store.subscribe(() => { topbar.render(); panel.render(); playback.render() })
topbar.render(); panel.render(); playback.render()

let last = performance.now()
const loop = (now: number) => {
  const dt = (now - last) / 1000
  last = now
  const s = store.get()
  if (s.playback.playing) {
    const end = duration(s.ensemble.reference)
    const tNext = s.playback.t + dt * s.playback.speed
    if (tNext >= end) { store.setT(end); store.setPlaying(false) }
    else store.setT(tNext)
  }
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)
