import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { CURRENT_USER, WAREHOUSES } from '../data/mockData'
import { slotPosition } from '../data/layout'
import type { Selection } from '../data/types'
import { engine } from '../simulation/engine'
import { useSim, type Speed } from '../store/useSimStore'
import { focusOn } from './actions'
import { DashboardSwitcher } from './DashboardSwitcher'
import { Icon, type IconName } from './Icon'

interface Result {
  icon: IconName
  title: string
  sub: string
  sel?: Selection
  site?: string
}

function GlobalSearch() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const { trucks, forklifts, docks } = useSim(useShallow((s) => ({ trucks: s.trucks, forklifts: s.forklifts, docks: s.docks })))
  const box = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [])

  const results = useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase()
    if (!term) return []
    const has = (...xs: (string | null | undefined)[]) => xs.some((x) => x?.toLowerCase().includes(term))
    const out: Result[] = []
    for (const w of WAREHOUSES) if (has(w.name, w.city)) out.push({ icon: 'site', title: w.name, sub: `Site · ${w.city}`, site: w.id })
    for (const t of trucks) if (has(t.id, t.plate, t.carrier, t.driver, t.orderId, t.lot)) out.push({ icon: 'truck', title: t.id, sub: `${t.carrier} · ${t.plate} · ${t.orderId}`, sel: { kind: 'truck', id: t.id } })
    for (const f of forklifts) if (has(f.id, f.operator, f.model)) out.push({ icon: 'forklift', title: f.id, sub: `${f.operator} · ${f.model}`, sel: { kind: 'forklift', id: f.id } })
    for (const d of docks) if (has(d.name, d.id)) out.push({ icon: 'dock', title: d.name, sub: `Doca · ${d.status}`, sel: { kind: 'dock', id: d.id } })
    engine.slots.forEach((m, i) => {
      if (m && out.length < 40 && has(m.id, m.sku, m.product, m.lot)) out.push({ icon: 'box', title: m.id, sub: `${m.product} · ${slotPosition(i).label} · ${m.lot}`, sel: { kind: 'pallet', id: String(i) } })
    })
    return out.slice(0, 12)
  }, [q, trucks, forklifts, docks])

  const choose = (r: Result) => {
    if (r.site) useSim.getState().setWarehouse(r.site)
    if (r.sel) focusOn(r.sel)
    setOpen(false)
    setQ('')
  }

  return (
    <div ref={box} className="relative w-full max-w-md">
      <div className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-2 focus-within:ring-2 focus-within:ring-blue-400/60">
        <Icon name="search" className="h-4 w-4 text-slate-400" />
        <input
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); setActive(0) }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(results.length - 1, a + 1)) }
            if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
            if (e.key === 'Enter' && results[active]) choose(results[active])
            if (e.key === 'Escape') setOpen(false)
          }}
          placeholder="Buscar sites, caminhões, empilhadeiras, paletes..."
          className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
        <kbd className="hidden rounded-md border border-slate-200 bg-slate-50 px-1.5 text-[10px] text-slate-400 lg:block">Enter</kbd>
      </div>
      {open && q && (
        <div className="glass absolute left-0 right-0 top-12 z-50 max-h-96 overflow-y-auto p-1.5 scrollbar-thin">
          {results.length === 0 && <div className="px-3 py-4 text-center text-sm text-slate-500">Nada encontrado para “{q}”</div>}
          {results.map((r, i) => (
            <button
              key={`${r.icon}${r.title}${i}`}
              onMouseEnter={() => setActive(i)}
              onClick={() => choose(r)}
              className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left ${i === active ? 'bg-blue-50' : ''}`}
            >
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700"><Icon name={r.icon} /></span>
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-slate-800">{r.title}</span>
                <span className="block truncate text-xs text-slate-500">{r.sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function WarehouseSelector() {
  const [open, setOpen] = useState(false)
  const { id, kpis, docks } = useSim(useShallow((s) => ({ id: s.warehouseId, kpis: s.kpis, docks: s.docks })))
  const current = WAREHOUSES.find((w) => w.id === id) ?? WAREHOUSES[0]
  const pct = Math.round((kpis.inventory / kpis.capacity) * 100)
  const busy = docks.filter((d) => d.status !== 'livre').length
  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-1.5 text-left hover:bg-white">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-slate-100 text-slate-600"><Icon name="site" /></span>
        <span>
          <span className="block text-sm font-semibold leading-tight text-slate-800">{current.name}</span>
          <span className="block text-[11px] leading-tight text-slate-500">{pct}% cheio · {busy}/{docks.length} docas</span>
        </span>
        <Icon name="chevron" className="h-4 w-4 text-slate-400" />
      </button>
      {open && (
        <div className="glass absolute right-0 top-14 z-50 w-72 p-1.5">
          {WAREHOUSES.map((w) => (
            <button
              key={w.id}
              onClick={() => { useSim.getState().setWarehouse(w.id); setOpen(false) }}
              className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-blue-50 ${w.id === id ? 'bg-blue-50' : ''}`}
            >
              <span>
                <span className="block text-sm font-semibold text-slate-800">{w.name}</span>
                <span className="block text-xs text-slate-500">{w.city}</span>
              </span>
              <span className="text-xs font-semibold text-slate-600">{w.id === id ? pct : Math.round(w.fillRatio * 100)}%</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function SimControls() {
  const { paused, speed, dayNight, clock } = useSim(useShallow((s) => ({ paused: s.paused, speed: s.speed, dayNight: s.dayNight, clock: s.clock })))
  const { togglePause, setSpeed, toggleDayNight } = useSim.getState()
  const onDayNight = () => {
    // The cycle follows the sim clock; during daytime jump straight to dusk so the effect is visible.
    const { dayNight: on, hour } = useSim.getState()
    if (!on && hour > 6 && hour < 19) engine.skipToHour(19.5)
    toggleDayNight()
  }
  return (
    <div className="flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white/80 p-1">
      <button onClick={togglePause} title={paused ? 'Retomar' : 'Pausar'} className="grid h-8 w-8 place-items-center rounded-lg text-slate-700 hover:bg-slate-100">
        <Icon name={paused ? 'play' : 'pause'} />
      </button>
      {([1, 2, 4] as Speed[]).map((s) => (
        <button
          key={s}
          onClick={() => setSpeed(s)}
          className={`h-8 rounded-lg px-2 text-xs font-bold ${!paused && speed === s ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          {s}x
        </button>
      ))}
      <span className="mx-1 h-5 w-px bg-slate-200" />
      <button onClick={onDayNight} title={dayNight ? 'Desligar ciclo dia/noite' : 'Ligar ciclo dia/noite (avança para o anoitecer)'} className={`flex h-8 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold ${dayNight ? 'bg-slate-800 text-amber-300' : 'text-slate-600 hover:bg-slate-100'}`}>
        <Icon name={dayNight ? 'moon' : 'sun'} />
        <span className="tabular-nums">{clock}</span>
      </button>
    </div>
  )
}

export function TopBar() {
  const paused = useSim((s) => s.paused)
  return (
    <header className="glass pointer-events-auto absolute left-4 right-4 top-4 z-30 flex items-center gap-4 px-4 py-2.5">
      <div className="flex shrink-0 items-center gap-2.5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-md shadow-blue-500/30">
          <Icon name="box" className="h-5 w-5" />
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-extrabold tracking-tight text-slate-900">Trycol</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Yard & Warehouse</div>
        </div>
      </div>
      <DashboardSwitcher />
      <div className="flex flex-1 justify-center"><GlobalSearch /></div>
      <WarehouseSelector />
      <SimControls />
      <div className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${paused ? 'bg-slate-200 text-slate-600' : 'bg-emerald-100 text-emerald-700'}`}>
        <span className="relative flex h-2 w-2">
          {!paused && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${paused ? 'bg-slate-500' : 'bg-emerald-500'}`} />
        </span>
        {paused ? 'Pausado' : 'Live'}
      </div>
      <div className="flex shrink-0 items-center gap-2.5 border-l border-slate-200 pl-4">
        <button className="relative grid h-9 w-9 place-items-center rounded-xl text-slate-500 hover:bg-white">
          <Icon name="bell" />
          <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
        </button>
        <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-xs font-bold text-white">{CURRENT_USER.initials}</div>
        <div className="hidden leading-tight xl:block">
          <div className="text-sm font-semibold text-slate-800">{CURRENT_USER.name}</div>
          <div className="text-[11px] text-slate-500">{CURRENT_USER.role}</div>
        </div>
      </div>
    </header>
  )
}
