import { useShallow } from 'zustand/react/shallow'
import { BAY_NAMES } from '../data/layout'
import type { TruckView } from '../data/types'
import { useSim } from '../store/useSimStore'
import { focusOn } from './actions'
import { Badge, TRUCK_STATUS, shipmentStep } from './format'
import { Icon } from './Icon'

const STEPS = ['Pedido confirmado', 'Separado', 'Carregando', 'Em trânsito', 'Entregue']
const STEPS_IN = ['Agendado', 'Na doca', 'Descarregando', 'Liberado', 'Concluído']

function stepDetail(t: TruckView, i: number) {
  switch (i) {
    case 0: return t.orderId
    case 1: return t.bay !== null ? BAY_NAMES[t.bay] : t.arrivedAt ? `chegou ${t.arrivedAt}` : '—'
    case 2: return t.type === 'outbound' ? `${t.cargo}/${t.target} paletes` : `${t.qty - t.cargo}/${t.qty} paletes`
    case 3: return t.status === 'em_rota' ? `ETA ${t.eta} min` : t.status === 'saindo' ? 'saindo do pátio' : '—'
    default: return t.status === 'entregue' ? (t.onTime === false ? 'com atraso' : 'no prazo') : t.destination
  }
}

export function ShipmentTracking() {
  const { truck, auto } = useSim(useShallow((s) => {
    const sel = s.selected?.kind === 'truck' ? s.trucks.find((t) => t.id === s.selected!.id) : undefined
    const fallback = s.trucks.find((t) => t.status === 'carregando') ?? s.trucks.find((t) => t.status === 'descarregando') ?? s.trucks[0]
    return { truck: sel ?? fallback, auto: !sel }
  }))

  if (!truck) return null
  const step = shipmentStep(truck.status)
  const labels = truck.type === 'outbound' ? STEPS : STEPS_IN
  const pct = Math.round(truck.progress * 100)

  return (
    <section className="glass pointer-events-auto absolute bottom-4 left-4 z-20 w-[min(560px,calc(100vw-500px))] min-w-[420px] px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900">Shipment Tracking</h3>
            {auto && <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500">em destaque</span>}
          </div>
          <button onClick={() => focusOn({ kind: 'truck', id: truck.id })} className="mt-0.5 flex items-center gap-1.5 text-xs text-slate-500 hover:text-blue-600">
            <Icon name={truck.type === 'outbound' ? 'arrowUp' : 'arrowDown'} className="h-3 w-3" />
            <span className="font-semibold text-slate-700">{truck.id}</span> · {truck.orderId} · {truck.origin} → {truck.destination}
          </button>
        </div>
        <Badge cls={TRUCK_STATUS[truck.status].cls}>{TRUCK_STATUS[truck.status].label}</Badge>
      </div>

      <ol className="relative mt-4 grid grid-cols-5">
        {labels.map((label, i) => {
          const done = i < step
          const active = i === step
          return (
            <li key={label} className="relative flex flex-col items-center text-center">
              {i > 0 && (
                <span className="absolute right-1/2 top-3.5 -z-0 h-0.5 w-full -translate-y-1/2 bg-slate-200">
                  <span className="block h-full bg-blue-500 transition-all duration-700" style={{ width: i <= step ? '100%' : '0%' }} />
                </span>
              )}
              <span className={`relative z-10 grid h-7 w-7 place-items-center rounded-full border-2 text-[11px] font-bold transition-colors ${
                done ? 'border-blue-600 bg-blue-600 text-white' : active ? 'border-blue-600 bg-white text-blue-600' : 'border-slate-200 bg-white text-slate-400'
              }`}>
                {done ? <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
                {active && <span className="absolute inset-0 animate-ping rounded-full border-2 border-blue-400 opacity-60" />}
              </span>
              <span className={`mt-1.5 text-[11px] font-semibold leading-tight ${done || active ? 'text-slate-800' : 'text-slate-400'}`}>{label}</span>
              <span className="text-[10px] leading-tight text-slate-500">{stepDetail(truck, i)}</span>
            </li>
          )
        })}
      </ol>

      <div className="mt-3 flex items-center gap-3 border-t border-slate-200/70 pt-3 text-xs text-slate-600">
        <span className="truncate"><span className="text-slate-400">Transportadora</span> {truck.carrier}</span>
        <span className="truncate"><span className="text-slate-400">Placa</span> {truck.plate}</span>
        <div className="ml-auto flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-200">
            <div className="h-full rounded-full bg-gradient-to-r from-blue-500 to-cyan-400 transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>
          <span className="font-semibold tabular-nums text-slate-700">{pct}%</span>
        </div>
      </div>
    </section>
  )
}
