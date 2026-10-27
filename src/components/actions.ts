import type { Selection } from '../data/types'
import { engine } from '../simulation/engine'
import { useSim } from '../store/useSimStore'

/** Select an object and fly the camera to it; vehicles are then followed while they move. */
export function focusOn(sel: Selection) {
  const s = useSim.getState()
  s.select(sel)
  const p = engine.positionOf(sel)
  const moving = sel.kind === 'truck' || sel.kind === 'forklift'
  if (p) s.cameraCmd({ type: 'focus', x: p.x, z: p.z, follow: moving ? sel : undefined })
}
