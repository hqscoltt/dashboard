import { useEffect, useMemo, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { DashboardSwitcher } from '../../components/DashboardSwitcher'
import { Icon, type IconName } from '../../components/Icon'
import { CURRENT_USER } from '../../data/mockData'
import { addVolume } from '../demoSim'
import { useUniverse, type Speed } from '../store'
import type { USelection } from '../types'
import { focusSelection } from './actions'

interface Result {
  icon: IconName
  title: string
  sub: string
  sel: USelection
}

function Search() {
  const [q, setQ] = useState('')
  const [open, setOpen] = useState(false)
  const [active, setActive] = useState(0)
  const { model, layout } = useUniverse(useShallow((s) => ({ model: s.model, layout: s.layout })))
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (e: MouseEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [])

  const results = useMemo<Result[]>(() => {
    const term = q.trim().toLowerCase()
    if (!term) return []
    const out: Result[] = []
    for (const id of layout.order) {
      const b = layout.buildings[id]
      if (b.label.toLowerCase().includes(term)) out.push({ icon: 'site', title: b.label, sub: 'Prédio', sel: { kind: 'building', id } })
    }
    for (const f of model.flows) {
      for (const it of f.items) {
        if (out.length > 30) break
        if (it.title.toLowerCase().includes(term) || it.id.toLowerCase().includes(term) || JSON.stringify(it.raw).toLowerCase().includes(term)) {
          out.push({ icon: 'box', title: it.title, sub: `${f.def.label} · ${f.stages.find((s) => s.value === it.stage)?.label ?? it.stage}`, sel: { kind: 'item', key: it.key } })
        }
      }
    }
    for (const s of model.stocks) for (const it of s.items) {
      if (it.title.toLowerCase().includes(term) || it.id.toLowerCase().includes(term)) out.push({ icon: 'box', title: it.title, sub: `${s.def.label} · ${it.qty.toLocaleString('pt-BR')}`, sel: { kind: 'stockItem', key: it.key } })
    }
    return out.slice(0, 14)
  }, [q, model, layout])

  const choose = (r: Result) => {
    focusSelection(r.sel)
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
          placeholder="Buscar prédios, registros, clientes, produtos..."
          className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
      </div>
      {open && q && (
        <div className="glass absolute left-0 right-0 top-12 z-50 max-h-96 overflow-y-auto p-1.5 scrollbar-thin">
          {results.length === 0 && <div className="px-3 py-4 text-center text-sm text-slate-500">Nada encontrado para “{q}”</div>}
          {results.map((r, i) => (
            <button key={`${r.title}${i}`} onMouseEnter={() => setActive(i)} onClick={() => choose(r)} className={`flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-left ${i === active ? 'bg-blue-50' : ''}`}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-blue-100 text-blue-700"><Icon name={r.icon} /></span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-semibold text-slate-800">{r.title}</span>
                <span className="block truncate text-xs text-slate-500">{r.sub}</span>
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function Status() {
  const { source, simulate, paused, apiStatus } = useUniverse(useShallow((s) => ({ source: s.source, simulate: s.simulate, paused: s.paused, apiStatus: s.apiStatus })))
  let text = 'Estático'
  let cls = 'bg-slate-200 text-slate-600'
  let pulse = false
  if (paused) text = 'Pausado'
  else if (source === 'api') {
    if (apiStatus.state === 'error') { text = 'API com erro'; cls = 'bg-rose-100 text-rose-700' }
    else { text = 'API ao vivo'; cls = 'bg-emerald-100 text-emerald-700'; pulse = true }
  } else if (simulate) { text = 'Simulação'; cls = 'bg-emerald-100 text-emerald-700'; pulse = true }
  return (
    <div className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${cls}`} title={apiStatus.message ?? apiStatus.at ?? ''}>
      <span className="relative flex h-2 w-2">
        {pulse && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${pulse ? 'bg-emerald-500' : cls.includes('rose') ? 'bg-rose-500' : 'bg-slate-500'}`} />
      </span>
      {text}
    </div>
  )
}

function Controls() {
  const { paused, speed, simulate, source } = useUniverse(useShallow((s) => ({ paused: s.paused, speed: s.speed, simulate: s.simulate, source: s.source })))
  const s = useUniverse.getState()
  return (
    <div className="flex items-center gap-1 rounded-xl border border-slate-200/80 bg-white/80 p-1">
      <button onClick={s.togglePause} title={paused ? 'Retomar' : 'Pausar'} className="grid h-8 w-8 place-items-center rounded-lg text-slate-700 hover:bg-slate-100">
        <Icon name={paused ? 'play' : 'pause'} />
      </button>
      {([1, 2, 4] as Speed[]).map((v) => (
        <button key={v} onClick={() => s.setSpeed(v)} className={`h-8 rounded-lg px-2 text-xs font-bold ${!paused && speed === v ? 'bg-blue-600 text-white shadow' : 'text-slate-600 hover:bg-slate-100'}`}>{v}x</button>
      ))}
      <span className="mx-1 h-5 w-px bg-slate-200" />
      {source !== 'api' && (
        <button
          onClick={() => s.setSimulate(!simulate)}
          title="Gera movimento de demonstração a partir dos seus próprios dados"
          className={`h-8 rounded-lg px-2 text-xs font-semibold ${simulate ? 'bg-emerald-100 text-emerald-700' : 'text-slate-600 hover:bg-slate-100'}`}
        >
          Simular
        </button>
      )}
      <button
        onClick={() => { const st = useUniverse.getState(); st.applyRaw(addVolume(st.model, st.raw, 160)) }}
        title="Adiciona 160 registros: os números sobem e as estantes enchem"
        className="h-8 rounded-lg px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
      >
        + Volume
      </button>
      <button onClick={() => s.setPanelOpen(true)} className="flex h-8 items-center gap-1 rounded-lg bg-slate-900 px-2.5 text-xs font-semibold text-white hover:bg-slate-700">
        <Icon name="site" className="h-3.5 w-3.5" /> Dados
      </button>
    </div>
  )
}

export function UTopBar() {
  return (
    <header className="glass pointer-events-auto absolute left-4 right-4 top-4 z-30 flex items-center gap-3 px-4 py-2.5">
      <div className="flex shrink-0 items-center gap-2.5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 text-white shadow-md shadow-blue-500/30">
          <Icon name="box" className="h-5 w-5" />
        </div>
        <div className="hidden leading-tight 2xl:block">
          <div className="text-[15px] font-extrabold tracking-tight text-slate-900">Trycol</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-400">Dashboard 3D</div>
        </div>
      </div>
      <DashboardSwitcher />
      <div className="flex flex-1 justify-center"><Search /></div>
      <Controls />
      <Status />
      <div className="flex shrink-0 items-center gap-2.5 border-l border-slate-200 pl-3">
        <div className="grid h-9 w-9 place-items-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-xs font-bold text-white">{CURRENT_USER.initials}</div>
        <div className="hidden leading-tight 2xl:block">
          <div className="text-sm font-semibold text-slate-800">{CURRENT_USER.name}</div>
          <div className="text-[11px] text-slate-500">{CURRENT_USER.role}</div>
        </div>
      </div>
    </header>
  )
}
