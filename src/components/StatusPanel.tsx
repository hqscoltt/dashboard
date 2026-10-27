import { useState, type ReactNode } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useSim } from '../store/useSimStore'
import { focusOn } from './actions'
import { Badge, DOCK_STATUS, FORKLIFT_STATUS, TRUCK_STATUS, truckLocation } from './format'
import { Icon, type IconName } from './Icon'

type Tab = 'docks' | 'forklifts' | 'trucks' | 'events'
const TABS: { id: Tab; label: string; icon: IconName }[] = [
  { id: 'docks', label: 'Docas', icon: 'dock' },
  { id: 'forklifts', label: 'Empilhadeiras', icon: 'forklift' },
  { id: 'trucks', label: 'Caminhões', icon: 'truck' },
  { id: 'events', label: 'Eventos', icon: 'bell' },
]

function Row({ selected, onClick, children }: { selected: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button onClick={onClick} className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left transition-colors ${selected ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-white/70'}`}>
      {children}
    </button>
  )
}

function Bar({ value, color = 'from-blue-500 to-cyan-400' }: { value: number; color?: string }) {
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
      <div className={`h-full rounded-full bg-gradient-to-r ${color} transition-all duration-500`} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  )
}

function Docks() {
  const { docks, trucks, sel } = useSim(useShallow((s) => ({ docks: s.docks, trucks: s.trucks, sel: s.selected })))
  return (
    <>
      {docks.map((d) => {
        const t = trucks.find((x) => x.id === d.truckId)
        const st = DOCK_STATUS[d.status]
        return (
          <Row key={d.id} selected={sel?.kind === 'dock' && sel.id === d.id} onClick={() => focusOn({ kind: 'dock', id: d.id })}>
            <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${st.dot}`} />
            <div className="w-16 shrink-0 text-sm font-bold text-slate-800">{d.name}</div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between text-xs">
                <span className="truncate text-slate-600">{t ? `${t.id} · ${TRUCK_STATUS[t.status].label}` : 'Sem veículo'}</span>
                <span className="tabular-nums text-slate-400">{d.movesToday} mov.</span>
              </div>
              <div className="mt-1"><Bar value={t && (t.status === 'carregando' || t.status === 'descarregando') ? t.progress * 100 : 0} /></div>
            </div>
            <Badge cls={st.cls}>{st.label}</Badge>
          </Row>
        )
      })}
    </>
  )
}

function Forklifts() {
  const { forklifts, sel } = useSim(useShallow((s) => ({ forklifts: s.forklifts, sel: s.selected })))
  return (
    <>
      {forklifts.map((f) => {
        const st = FORKLIFT_STATUS[f.status]
        return (
          <Row key={f.id} selected={sel?.kind === 'forklift' && sel.id === f.id} onClick={() => focusOn({ kind: 'forklift', id: f.id })}>
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-amber-100 text-amber-700"><Icon name="forklift" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-bold text-slate-800">{f.id}</span>
                <span className="truncate text-xs text-slate-500">{f.operator}</span>
              </div>
              <div className="truncate text-[11px] text-slate-500">{f.location}{f.truckId ? ` · ${f.truckId}` : ''}</div>
            </div>
            <div className="w-16 shrink-0">
              <div className="mb-0.5 text-right text-[10px] font-semibold tabular-nums text-slate-500">{f.battery}%</div>
              <Bar value={f.battery} color={f.battery < 30 ? 'from-rose-500 to-amber-400' : 'from-emerald-500 to-lime-400'} />
            </div>
            <Badge cls={st.cls}>{st.label}</Badge>
          </Row>
        )
      })}
    </>
  )
}

function Trucks() {
  const { trucks, sel } = useSim(useShallow((s) => ({ trucks: s.trucks, sel: s.selected })))
  return (
    <>
      {trucks.map((t) => {
        const st = TRUCK_STATUS[t.status]
        return (
          <Row key={t.id} selected={sel?.kind === 'truck' && sel.id === t.id} onClick={() => focusOn({ kind: 'truck', id: t.id })}>
            <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg ${t.type === 'outbound' ? 'bg-blue-100 text-blue-700' : 'bg-cyan-100 text-cyan-700'}`}>
              <Icon name={t.type === 'outbound' ? 'arrowUp' : 'arrowDown'} />
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm">
                <span className="font-bold text-slate-800">{t.id}</span>
                <span className="truncate text-xs text-slate-500">{t.carrier}</span>
              </div>
              <div className="truncate text-[11px] text-slate-500">{truckLocation(t)}</div>
            </div>
            <Badge cls={st.cls}>{st.label}</Badge>
          </Row>
        )
      })}
    </>
  )
}

function Events() {
  const events = useSim((s) => s.events)
  const tone = { info: 'bg-blue-500', success: 'bg-emerald-500', warn: 'bg-amber-500' }
  return (
    <ul className="space-y-0.5 px-1">
      {events.map((e) => (
        <li key={e.id} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-xs">
          <span className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${tone[e.tone]}`} />
          <span className="w-10 shrink-0 tabular-nums text-slate-400">{e.time}</span>
          <span className="text-slate-700">{e.text}</span>
        </li>
      ))}
    </ul>
  )
}

export function StatusPanel() {
  const [tab, setTab] = useState<Tab>('docks')
  const counts = useSim(useShallow((s) => ({
    docks: s.docks.filter((d) => d.status !== 'livre').length,
    forklifts: s.forklifts.filter((f) => f.status !== 'ocioso' && f.status !== 'recarregando').length,
    trucks: s.trucks.length,
  })))
  return (
    <section className="glass pointer-events-auto absolute bottom-4 right-4 z-20 flex h-[296px] w-[480px] flex-col p-2">
      <div className="flex gap-1 rounded-xl bg-slate-100/80 p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex flex-1 items-center justify-center gap-1 rounded-lg px-1.5 py-1.5 text-[11.5px] font-semibold transition ${tab === t.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
          >
            <Icon name={t.icon} className="h-3.5 w-3.5" />
            {t.label}
            {t.id !== 'events' && (
              <span className={`rounded-full px-1.5 text-[10px] ${tab === t.id ? 'bg-blue-100' : 'bg-slate-200'}`}>{counts[t.id]}</span>
            )}
          </button>
        ))}
      </div>
      <div className="mt-1.5 flex-1 space-y-0.5 overflow-y-auto pr-1 scrollbar-thin">
        {tab === 'docks' && <Docks />}
        {tab === 'forklifts' && <Forklifts />}
        {tab === 'trucks' && <Trucks />}
        {tab === 'events' && <Events />}
      </div>
    </section>
  )
}
