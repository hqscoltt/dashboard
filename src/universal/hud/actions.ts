import { fleet } from '../fleet'
import { useUniverse } from '../store'
import type { USelection } from '../types'

/** Building that currently shows a selection (an item's stage building, a stock's warehouse…). */
export function buildingOf(sel: USelection): string | null {
  const s = useUniverse.getState()
  if (sel.kind === 'building') return sel.id
  if (sel.kind === 'stockItem') return `stock:${sel.key.split(':')[0]}`
  if (sel.kind === 'truck') return null
  for (const f of s.model.flows) {
    const it = f.items.find((i) => i.key === sel.key)
    if (it) return `stage:${f.def.id}:${it.stage}`
  }
  return null
}

/** Select something and fly the camera to the building that holds it. */
export function focusSelection(sel: USelection) {
  const s = useUniverse.getState()
  s.select(sel)
  if (sel.kind === 'truck') {
    const t = fleet.trucks.find((v) => String(v.id) === sel.key)
    if (t) s.cameraCmd({ type: 'focus', x: t.x, z: t.z, zoom: 20 })
    return
  }
  const id = buildingOf(sel)
  const b = id ? s.layout.buildings[id] : null
  if (b) s.cameraCmd({ type: 'focus', x: b.x + b.w / 2, z: b.z - b.d / 2, zoom: Math.min(30, Math.max(12, 700 / Math.max(b.w, b.d))) })
}
