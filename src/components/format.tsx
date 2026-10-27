import type { ReactNode } from 'react'
import type { DockStatus, ForkliftStatus, TruckStatus, TruckView } from '../data/types'
import { BAY_NAMES } from '../data/layout'

export const TRUCK_STATUS: Record<TruckStatus, { label: string; cls: string }> = {
  em_transito: { label: 'Em trânsito', cls: 'bg-slate-100 text-slate-600' },
  chegando: { label: 'Chegando', cls: 'bg-sky-100 text-sky-700' },
  aguardando: { label: 'Aguardando', cls: 'bg-amber-100 text-amber-700' },
  docado: { label: 'Docado', cls: 'bg-indigo-100 text-indigo-700' },
  carregando: { label: 'Carregando', cls: 'bg-blue-600 text-white' },
  descarregando: { label: 'Descarregando', cls: 'bg-cyan-600 text-white' },
  saindo: { label: 'Saindo', cls: 'bg-violet-100 text-violet-700' },
  em_rota: { label: 'Em rota', cls: 'bg-slate-200 text-slate-700' },
  entregue: { label: 'Entregue', cls: 'bg-emerald-100 text-emerald-700' },
}

export const FORKLIFT_STATUS: Record<ForkliftStatus, { label: string; cls: string }> = {
  ocioso: { label: 'Ocioso', cls: 'bg-slate-100 text-slate-600' },
  indo_coletar: { label: 'Indo coletar', cls: 'bg-sky-100 text-sky-700' },
  elevando: { label: 'Elevando', cls: 'bg-indigo-100 text-indigo-700' },
  transportando: { label: 'Transportando', cls: 'bg-blue-600 text-white' },
  baixando: { label: 'Depositando', cls: 'bg-cyan-100 text-cyan-700' },
  retornando: { label: 'Retornando', cls: 'bg-slate-200 text-slate-700' },
  recarregando: { label: 'Recarregando', cls: 'bg-amber-100 text-amber-700' },
}

export const DOCK_STATUS: Record<DockStatus, { label: string; cls: string; dot: string }> = {
  livre: { label: 'Livre', cls: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  reservada: { label: 'Reservada', cls: 'bg-amber-100 text-amber-700', dot: 'bg-amber-500' },
  ocupada: { label: 'Ocupada', cls: 'bg-rose-100 text-rose-700', dot: 'bg-rose-500' },
}

export function truckLocation(t: TruckView) {
  switch (t.status) {
    case 'em_transito': return t.eta > 0 ? `Rodovia SC-418 · ETA ${t.eta} min` : 'Portaria · aguardando entrada'
    case 'chegando': return t.bay !== null ? `Pátio → ${BAY_NAMES[t.bay]}` : `Pátio → vaga P${(t.parking ?? 0) + 1}`
    case 'aguardando': return `Pátio · vaga P${(t.parking ?? 0) + 1}`
    case 'docado': case 'carregando': case 'descarregando': return BAY_NAMES[t.bay ?? 0]
    case 'saindo': return 'Pátio → saída'
    case 'em_rota': return `A caminho de ${t.destination} · ${t.eta} min`
    case 'entregue': return t.destination
  }
}

/** Index of the active step in the shipment stepper (5 = all done). */
export function shipmentStep(s: TruckStatus) {
  switch (s) {
    case 'em_transito': case 'chegando': case 'aguardando': return 0
    case 'docado': return 1
    case 'carregando': case 'descarregando': return 2
    case 'saindo': case 'em_rota': return 3
    case 'entregue': return 5
  }
}

export function Badge({ cls, children }: { cls: string; children: ReactNode }) {
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold ${cls}`}>{children}</span>
}
