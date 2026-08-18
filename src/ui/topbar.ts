import type { Store, Tab } from '../state'

const TABS: Array<[Tab, string]> = [
  ['lorenz', 'Lorenz'], ['pendulum', 'Pendulum'], ['nbody', 'N-body'],
]

export const createTopbar = (store: Store) => {
  const el = document.createElement('div')
  el.style.display = 'contents'
  const buttons = new Map<Tab, HTMLButtonElement>()
  for (const [tab, label] of TABS) {
    const b = document.createElement('button')
    b.textContent = label
    b.addEventListener('click', () => store.setTab(tab))
    buttons.set(tab, b)
    el.appendChild(b)
  }
  const render = () => {
    const active = store.get().tab
    for (const [tab, b] of buttons) b.classList.toggle('active', tab === active)
  }
  return { el, render }
}
