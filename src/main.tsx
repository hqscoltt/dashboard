import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

if (import.meta.env.DEV) {
  // handy for debugging in the browser console: __Trycol.engine / .store / .universe / .fleet
  void Promise.all([import('./simulation/engine'), import('./store/useSimStore'), import('./universal/store'), import('./universal/fleet'), import('./universal/hud/actions')]).then(([e, s, u, f, a]) => {
    ;(window as unknown as Record<string, unknown>).__Trycol = { engine: e.engine, store: s.useSim, universe: u.useUniverse, fleet: f.fleet, focus: a.focusSelection }
  })
}
