// Logistics yard: corner-bracket box + label for the selected object, and the route of the
// selected truck / forklift.
import { useShallow } from 'zustand/react/shallow'
import { BAY_X, WAREHOUSE, slotPosition } from '../data/layout'
import { engine } from '../simulation/engine'
import { useSim } from '../store/useSimStore'
import { FORKLIFT_STATUS, TRUCK_STATUS, DOCK_STATUS } from '../components/format'
import { RoutePath, SelectionBox, type BoxInfo } from './SelectionBox'

const STATUS_HEX: Record<string, string> = {
  carregando: '#2563eb', descarregando: '#0891b2', docado: '#4f46e5', chegando: '#0284c7', aguardando: '#d97706',
  saindo: '#7c3aed', indo_coletar: '#0284c7', elevando: '#4f46e5', transportando: '#2563eb', baixando: '#0891b2',
  retornando: '#64748b', recarregando: '#d97706', livre: '#16a34a', reservada: '#d97706', ocupada: '#dc2626',
}

export function LogisticsSelection() {
  const sel = useSim((s) => s.selected)
  const info = useSim(
    useShallow((s) => {
      const x = s.selected
      if (!x) return { label: '', status: '', code: '' }
      if (x.kind === 'truck') {
        const t = s.trucks.find((v) => v.id === x.id)
        return { label: x.id, status: t ? TRUCK_STATUS[t.status].label : '', code: t?.status ?? '' }
      }
      if (x.kind === 'forklift') {
        const f = s.forklifts.find((v) => v.id === x.id)
        return { label: x.id, status: f ? FORKLIFT_STATUS[f.status].label : '', code: f?.status ?? '' }
      }
      if (x.kind === 'dock') {
        const d = s.docks.find((v) => v.id === x.id)
        return { label: d?.name ?? x.id, status: d ? DOCK_STATUS[d.status].label : '', code: d?.status ?? '' }
      }
      const meta = engine.slots[Number(x.id)]
      return { label: meta ? `${meta.id} · ${meta.product.split(' (')[0]}` : slotPosition(Number(x.id)).label, status: meta ? 'Armazenado' : 'Vazio', code: meta ? 'livre' : '' }
    }),
  )
  if (!sel) return null

  const getBox = (): BoxInfo | null => {
    switch (sel.kind) {
      case 'truck': {
        const t = engine.trucks.find((v) => v.v.id === sel.id)
        return t?.visible ? { x: t.x, y: 2.2, z: t.z, w: 3.1, h: 4.4, d: 10.8, rot: t.heading } : null
      }
      case 'forklift': {
        const f = engine.forklifts.find((v) => v.v.id === sel.id)
        return f ? { x: f.x + Math.sin(f.heading) * 0.35, y: 1.3, z: f.z + Math.cos(f.heading) * 0.35, w: 1.6, h: 2.6, d: 3.1, rot: f.heading } : null
      }
      case 'dock': {
        const i = engine.docks.findIndex((d) => d.v.id === sel.id)
        return i >= 0 ? { x: BAY_X[i], y: 2.9, z: WAREHOUSE.maxZ, w: 4.9, h: 5.8, d: 1.6, rot: 0 } : null
      }
      case 'pallet': {
        const p = slotPosition(Number(sel.id))
        return { x: p.x, y: p.y + 0.62, z: p.z, w: 1.5, h: 1.35, d: 1.3, rot: 0 }
      }
    }
  }

  const getPath = () => {
    if (sel.kind === 'truck') {
      const t = engine.trucks.find((v) => v.v.id === sel.id)
      return t?.visible && t.path.length ? [{ x: t.x, z: t.z }, ...t.path] : null
    }
    if (sel.kind === 'forklift') {
      const f = engine.forklifts.find((v) => v.v.id === sel.id)
      return f && f.path.length ? [{ x: f.x, z: f.z }, ...f.path] : null
    }
    return null
  }

  return (
    <>
      <SelectionBox get={getBox} label={info.label} status={info.status} color={STATUS_HEX[info.code] ?? '#64748b'} />
      {(sel.kind === 'truck' || sel.kind === 'forklift') && <RoutePath get={getPath} />}
    </>
  )
}
