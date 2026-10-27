import { memo } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useSim } from '../store/useSimStore'
import { Icon, type IconName } from './Icon'

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / span) * 24}`)
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-24">
      <polygon points={`0,30 ${pts.join(' ')} 100,30`} fill={color} opacity={0.12} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

interface CardProps {
  icon: IconName
  label: string
  value: string
  unit?: string
  delta: number
  deltaLabel: string
  sub: string
  data: number[]
  color: string
}

const Card = memo(function Card({ icon, label, value, unit, delta, deltaLabel, sub, data, color }: CardProps) {
  const up = delta >= 0
  return (
    <div className="glass pointer-events-auto w-[228px] px-4 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <span className="grid h-6 w-6 place-items-center rounded-lg" style={{ background: `${color}1f`, color }}><Icon name={icon} className="h-3.5 w-3.5" /></span>
          {label}
        </div>
        <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${up ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
          {up ? '+' : ''}{deltaLabel}
        </span>
      </div>
      <div className="mt-1.5 flex items-end justify-between">
        <div>
          <div className="text-[26px] font-extrabold leading-none tracking-tight text-slate-900 tabular-nums">
            {value}<span className="ml-0.5 text-sm font-semibold text-slate-400">{unit}</span>
          </div>
          <div className="mt-1 text-[11px] text-slate-500">{sub}</div>
        </div>
        <Sparkline data={data} color={color} />
      </div>
    </div>
  )
})

export function KpiCards() {
  const { kpis, baseline, history } = useSim(useShallow((s) => ({ kpis: s.kpis, baseline: s.baseline, history: s.history })))
  const invDelta = kpis.inventory - baseline.inventory
  const truckDelta = kpis.trucksInYard - baseline.trucksInYard
  const otDelta = +(kpis.onTimePct - baseline.onTimePct).toFixed(1)
  return (
    <div className="absolute left-4 top-[92px] z-20 flex flex-wrap gap-3">
      <Card icon="box" label="Estoque" value={String(kpis.inventory)} unit="paletes" delta={invDelta} deltaLabel={String(invDelta)}
        sub={`${Math.round((kpis.inventory / kpis.capacity) * 100)}% de ${kpis.capacity} posições`} data={history.inventory} color="#2563eb" />
      <Card icon="truck" label="Caminhões no pátio" value={String(kpis.trucksInYard)} delta={truckDelta} deltaLabel={String(truckDelta)}
        sub="docados, manobrando ou aguardando" data={history.trucksInYard} color="#0891b2" />
      <Card icon="check" label="Entregas no prazo" value={kpis.onTimePct.toFixed(1)} unit="%" delta={otDelta} deltaLabel={`${otDelta.toFixed(1)}%`}
        sub="acumulado dos últimos 30 dias" data={history.onTimePct} color="#059669" />
    </div>
  )
}
