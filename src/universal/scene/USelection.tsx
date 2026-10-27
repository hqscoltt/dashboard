// Universal dashboard: corner-bracket selection box + label, and the route of a selected truck
// (or of the truck carrying the selected record).
import { useShallow } from 'zustand/react/shallow'
import { RoutePath, SelectionBox, type BoxInfo } from '../../scene/SelectionBox'
import { fleet, type UTruck } from '../fleet'
import { FRONT, ROW_PITCH, palletSlot, palletsPerGroup } from '../layout'
import { useUniverse } from '../store'

export const PHASE_LABEL: Record<UTruck['phase'], string> = {
  toA: 'Indo coletar', waitA: 'Aguardando doca', dockA: 'Manobrando', loadA: 'Carregando',
  toB: 'Em trânsito', waitB: 'Aguardando doca', dockB: 'Manobrando', unloadB: 'Descarregando', exit: 'Saindo',
}

function truckBox(t: UTruck): BoxInfo {
  return { x: t.x, y: 2.2, z: t.z, w: 3.1, h: 4.4, d: 10.8, rot: t.heading }
}

/** Truck currently carrying a record (or heading to pick it up). */
export function truckOf(key: string) {
  return fleet.trucks.find((t) => t.keys.includes(key))
}

function itemBox(key: string): BoxInfo | null {
  const s = useUniverse.getState()
  const tr = s.transit[key]
  if (tr && tr.at === null) {
    const t = truckOf(key)
    return t ? truckBox(t) : null
  }
  for (const [id, keys] of Object.entries(s.contents)) {
    const i = keys.indexOf(key)
    if (i < 0) continue
    const b = s.layout.buildings[id]
    if (!b) return null
    const p = palletSlot(i, b.bays)
    return { x: b.x + p.x, y: p.y + 0.62, z: b.z + p.z, w: 1.5, h: 1.35, d: 1.3, rot: 0 }
  }
  return null
}

function stockItemBox(key: string): BoxInfo | null {
  const s = useUniverse.getState()
  const stockId = key.split(':')[0]
  const b = s.layout.buildings[`stock:${stockId}`]
  if (!b) return null
  const groups = palletsPerGroup(s.model, stockId, s.palletUnits[stockId] ?? 1)
  for (let gi = 0; gi < groups.length; gi++) {
    let p = 0
    for (const it of groups[gi].items) {
      if (it.key === key) {
        const slot = palletSlot(p, b.bays)
        return { x: b.x + slot.x, y: slot.y + 0.62, z: b.z - (FRONT + gi * ROW_PITCH + 1), w: 1.5, h: 1.35, d: 1.3, rot: 0 }
      }
      p += it.pallets
    }
  }
  return null
}

export function UniverseSelection() {
  const sel = useUniverse((s) => s.selected)
  const info = useUniverse(
    useShallow((s) => {
      const x = s.selected
      if (!x) return { label: '', status: '', color: '#64748b' }
      if (x.kind === 'building') {
        const b = s.layout.buildings[x.id]
        // same total as the details panel (includes records still on their way in)
        const total = b?.kind === 'stage' ? s.model.flows.find((f) => f.def.id === b.flowId)?.items.filter((i) => i.stage === b.stage).length ?? 0 : 0
        return { label: b?.label ?? '', status: b?.kind === 'stage' ? `${total.toLocaleString('pt-BR')} registros` : b?.kind === 'stock' ? 'Estoque' : 'Sede', color: b?.color ?? '#2563eb' }
      }
      if (x.kind === 'truck') {
        const t = fleet.trucks.find((v) => String(v.id) === x.key)
        return { label: `Caminhão ${x.key.padStart(3, '0')}`, status: t ? PHASE_LABEL[t.phase] : 'Saiu', color: '#2563eb' }
      }
      if (x.kind === 'item') {
        const f = s.model.flows.find((v) => x.key.startsWith(`${v.def.id}:`))
        const it = f?.items.find((v) => v.key === x.key)
        const st = f?.stages.find((v) => v.value === it?.stage)
        const moving = s.transit[x.key]
        return { label: it?.title ?? x.key, status: moving ? 'Em movimento' : st?.label ?? '', color: st?.color ?? '#2563eb' }
      }
      const stock = s.model.stocks.find((v) => x.key.startsWith(`${v.def.id}:`))
      const it = stock?.items.find((v) => v.key === x.key)
      return { label: it?.title ?? x.key, status: it ? `${it.qty.toLocaleString('pt-BR')} ${stock?.def.unit ?? 'un.'}` : '', color: it?.low ? '#e11d48' : '#059669' }
    }),
  )
  if (!sel) return null

  const getBox = (): BoxInfo | null => {
    const s = useUniverse.getState()
    switch (sel.kind) {
      case 'building': {
        const b = s.layout.buildings[sel.id]
        return b ? { x: b.x + b.w / 2, y: b.h / 2 + 0.2, z: b.z - b.d / 2, w: b.w + 1.2, h: b.h + 0.6, d: b.d + 1.2, rot: 0 } : null
      }
      case 'truck': {
        const t = fleet.trucks.find((v) => String(v.id) === sel.key)
        return t ? truckBox(t) : null
      }
      case 'item':
        return itemBox(sel.key)
      case 'stockItem':
        return stockItemBox(sel.key)
    }
  }

  const getPath = () => {
    const t = sel.kind === 'truck' ? fleet.trucks.find((v) => String(v.id) === sel.key) : sel.kind === 'item' ? truckOf(sel.key) : undefined
    return t && t.path.length ? [{ x: t.x, z: t.z }, ...t.path] : null
  }

  return (
    <>
      <SelectionBox get={getBox} label={info.label} status={info.status} color={info.color} />
      {(sel.kind === 'truck' || sel.kind === 'item') && <RoutePath get={getPath} />}
    </>
  )
}
