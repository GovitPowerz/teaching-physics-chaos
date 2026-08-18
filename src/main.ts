import './style.css'
import { duration } from './sim/simulate'
import { createStore, type Tab } from './state'
import { createPanel } from './ui/panel'
import { createPlayback } from './ui/playback'
import { createTopbar } from './ui/topbar'
import { sliderRow } from './ui/controls'
import { createLorenzScene } from './render/lorenzScene'
import { createPendulumScene } from './render/pendulumScene'
import { createNbodyScene } from './render/nbodyScene'

export interface SceneRenderer {
  mount: (root: HTMLElement) => void
  unmount: () => void
  render: () => void
}

const store = createStore()
const sceneRoot = document.getElementById('scene')!

const scenes: Record<Tab, SceneRenderer> = {
  lorenz: createLorenzScene(store),
  pendulum: createPendulumScene(store),
  nbody: createNbodyScene(store),
}

const topbar = createTopbar(store)
document.getElementById('topbar')!.appendChild(topbar.el)
const panel = createPanel(store)
const playback = createPlayback(store)

const kRow = sliderRow('copies K', 2, 10, 1,
  () => store.get().shared.K, (val) => store.setShared({ K: val }))
const epsRow = sliderRow('log10(epsilon)', -9, -2, 1,
  () => store.get().shared.epsExp, (val) => store.setShared({ epsExp: val }))
kRow.el.classList.add('shared')
epsRow.el.classList.add('shared')

const playbar = document.createElement('div')
playbar.id = 'playbar'
playbar.append(playback.el, kRow.el, epsRow.el)

const panelRoot = document.getElementById('panel')!
panelRoot.append(playbar, panel.el)

let activeTab: Tab = store.get().tab
scenes[activeTab].mount(sceneRoot)

store.subscribe(() => {
  const tab = store.get().tab
  if (tab !== activeTab) {
    scenes[activeTab].unmount()
    activeTab = tab
    scenes[activeTab].mount(sceneRoot)
  }
  topbar.render()
  panel.render()
  playback.render()
  kRow.refresh()
  epsRow.refresh()
})
topbar.render(); panel.render(); playback.render()

let last = performance.now()
const loop = (now: number) => {
  const dt = (now - last) / 1000
  last = now
  const s = store.get()
  if (s.playback.playing) {
    const tNext = s.playback.t + dt * s.playback.speed
    const tEnd = duration(s.ensemble.reference)
    if (tNext >= tEnd) { store.setT(tEnd); store.setPlaying(false) }
    else store.setT(tNext)
  }
  scenes[activeTab].render()
  requestAnimationFrame(loop)
}
requestAnimationFrame(loop)
