import { useEffect, useRef, useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Icon, type IconName } from '../../components/Icon'
import { fleet } from '../fleet'
import { displayValue, formatValue, getPath } from '../mapping'
import { PHASE_LABEL } from '../scene/USelection'
import { useUniverse } from '../store'
import type { UFlow } from '../types'
import { focusSelection } from './actions'

// ------------------------------------------------------------------ KPI cards

function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null
  const min = Math.min(...data)
  const max = Math.max(...data)
  const span = max - min || 1
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * 100},${28 - ((v - min) / span) * 24}`)
  return (
    <svg viewBox="0 0 100 30" preserveAspectRatio="none" className="h-8 w-20">
      <polygon points={`0,30 ${pts.join(' ')} 100,30`} fill={color} opacity={0.12} />
      <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth={1.8} vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
    </svg>
  )
}

const KPI_COLORS = ['#2563eb', '#0891b2', '#059669', '#7c3aed']

export function UKpis() {
  const { kpis, base, hist } = useUniverse(useShallow((s) => ({ kpis: s.model.kpis, base: s.kpiBaseline, hist: s.kpiHistory })))
  return (
    <div className="absolute left-4 top-[92px] z-20 flex flex-wrap gap-3">
      {kpis.slice(0, 4).map((k, i) => {
        const d = k.value - (base[i] ?? k.value)
        const up = d >= 0
        const delta = k.format === 'percent' ? `${d.toFixed(1)} p.p.` : formatValue(Math.abs(d), k.format)
        return (
          <div key={k.label} className="glass pointer-events-auto w-[212px] px-4 py-3">
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-xs font-semibold text-slate-500">{k.label}</span>
              <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[11px] font-bold tabular-nums ${up ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {up ? '+' : '−'}{delta.replace('-', '')}
              </span>
            </div>
            <div className="mt-1.5 flex items-end justify-between gap-2">
              <div className="truncate text-[22px] font-extrabold leading-none tracking-tight text-slate-900 tabular-nums">{formatValue(k.value, k.format)}</div>
              <Sparkline data={hist[i] ?? []} color={KPI_COLORS[i % KPI_COLORS.length]} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ------------------------------------------------------------------ funnel / item stepper (bottom-left)

function Funnel({ flow, counts }: { flow: UFlow; counts: Record<string, number> }) {
  const values = flow.stages.map((s) => flow.items.filter((i) => i.stage === s.value).length)
  const max = Math.max(1, ...values)
  return (
    <div className="mt-3 space-y-1.5">
      {flow.stages.map((s, i) => {
        const inTransit = values[i] - (counts[`stage:${flow.def.id}:${s.value}`] ?? 0)
        return (
          <button key={s.value} onClick={() => focusSelection({ kind: 'building', id: `stage:${flow.def.id}:${s.value}` })} className="flex w-full items-center gap-2 text-left text-xs">
            <span className="w-28 shrink-0 truncate font-semibold text-slate-700">{s.label}</span>
            <span className="relative h-5 flex-1 overflow-hidden rounded-md bg-slate-100">
              <span className="absolute inset-y-0 left-0 rounded-md transition-all duration-700" style={{ width: `${(values[i] / max) * 100}%`, background: s.color, opacity: s.terminal ? 0.45 : 0.85 }} />
              <span className="relative z-10 px-2 font-bold leading-5 text-slate-800 tabular-nums">{values[i].toLocaleString('pt-BR')}</span>
            </span>
            <span className="w-12 shrink-0 text-right tabular-nums text-slate-400">{inTransit > 0 ? `+${inTransit} ↝` : ''}</span>
          </button>
        )
      })}
    </div>
  )
}

function ItemStepper({ flow, stage }: { flow: UFlow; stage: string }) {
  const main = flow.stages.filter((s) => !s.terminal)
  const lost = flow.stages.find((s) => s.value === stage && s.terminal)
  const idx = main.findIndex((s) => s.value === stage)
  return (
    <ol className="relative mt-4 flex">
      {main.map((s, i) => {
        const done = !lost && i < idx
        const active = !lost && i === idx
        return (
          <li key={s.value} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && (
              <span className="absolute right-1/2 top-3.5 h-0.5 w-full -translate-y-1/2 bg-slate-200">
                <span className="block h-full bg-blue-500 transition-all duration-700" style={{ width: !lost && i <= idx ? '100%' : '0%' }} />
              </span>
            )}
            <span className={`relative z-10 grid h-7 w-7 place-items-center rounded-full border-2 text-[11px] font-bold ${done ? 'border-blue-600 bg-blue-600 text-white' : active ? 'border-blue-600 bg-white text-blue-600' : 'border-slate-200 bg-white text-slate-400'}`}>
              {done ? <Icon name="check" className="h-3.5 w-3.5" strokeWidth={3} /> : i + 1}
              {active && <span className="absolute inset-0 animate-ping rounded-full border-2 border-blue-400 opacity-60" />}
            </span>
            <span className={`mt-1.5 text-[11px] font-semibold leading-tight ${done || active ? 'text-slate-800' : 'text-slate-400'}`}>{s.label}</span>
          </li>
        )
      })}
      {lost && <li className="ml-2 self-start rounded-full bg-slate-200 px-2 py-1 text-[11px] font-bold text-slate-600">{lost.label}</li>}
    </ol>
  )
}

export function UFunnel() {
  const { flows, counts, selected } = useUniverse(useShallow((s) => ({ flows: s.model.flows, counts: s.counts, selected: s.selected })))
  const [tab, setTab] = useState(0)
  if (!flows.length) return null
  const item = selected?.kind === 'item' ? flows.flatMap((f) => f.items).find((i) => i.key === selected.key) : undefined
  const itemFlow = item ? flows.find((f) => f.def.id === item.flowId) : undefined
  const flow = itemFlow ?? flows[Math.min(tab, flows.length - 1)]

  return (
    <section className="glass pointer-events-auto absolute bottom-4 left-4 z-20 w-[min(520px,calc(100vw-560px))] min-w-[400px] px-5 py-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-bold text-slate-900">{item ? `Etapas · ${item.title}` : `Funil · ${flow.def.label}`}</h3>
        {!item && flows.length > 1 && (
          <div className="flex gap-1 rounded-lg bg-slate-100/80 p-0.5">
            {flows.map((f, i) => (
              <button key={f.def.id} onClick={() => setTab(i)} className={`rounded-md px-2 py-1 text-[11px] font-semibold ${flow === f ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500'}`}>{f.def.label}</button>
            ))}
          </div>
        )}
      </div>
      {item && itemFlow ? <ItemStepper flow={itemFlow} stage={item.stage} /> : <Funnel flow={flow} counts={counts} />}
    </section>
  )
}

// ------------------------------------------------------------------ lists (bottom-right)

export function UList() {
  const { flows, stocks, events, selected } = useUniverse(useShallow((s) => ({ flows: s.model.flows, stocks: s.model.stocks, events: s.events, selected: s.selected })))
  const tabs: { id: string; label: string; icon: IconName }[] = [
    ...flows.map((f) => ({ id: `f:${f.def.id}`, label: f.def.label, icon: 'box' as IconName })),
    ...stocks.map((s) => ({ id: `s:${s.def.id}`, label: s.def.label, icon: 'dock' as IconName })),
    { id: 'events', label: 'Eventos', icon: 'bell' },
  ]
  const [tab, setTab] = useState(tabs[0]?.id ?? 'events')
  const [stage, setStage] = useState<string | null>(null)
  const current = tabs.find((t) => t.id === tab) ? tab : tabs[0].id
  const flow = flows.find((f) => `f:${f.def.id}` === current)
  const stock = stocks.find((s) => `s:${s.def.id}` === current)

  return (
    <section className="glass pointer-events-auto absolute bottom-4 right-4 z-20 flex h-[300px] w-[460px] flex-col p-2">
      <div className="flex gap-1 overflow-x-auto rounded-xl bg-slate-100/80 p-1 scrollbar-thin">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => { setTab(t.id); setStage(null) }} className={`flex shrink-0 items-center gap-1 rounded-lg px-2.5 py-1.5 text-[11.5px] font-semibold ${current === t.id ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}>
            <Icon name={t.icon} className="h-3.5 w-3.5" />{t.label}
          </button>
        ))}
      </div>
      {flow && (
        <div className="mt-1.5 flex gap-1 overflow-x-auto pb-0.5 scrollbar-thin">
          <button onClick={() => setStage(null)} className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${stage === null ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600'}`}>Todos</button>
          {flow.stages.map((s) => (
            <button key={s.value} onClick={() => setStage(s.value)} className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${stage === s.value ? 'text-white' : 'bg-slate-100 text-slate-600'}`} style={stage === s.value ? { background: s.color } : undefined}>{s.label}</button>
          ))}
        </div>
      )}
      <div className="mt-1 flex-1 space-y-0.5 overflow-y-auto pr-1 scrollbar-thin">
        {flow &&
          flow.items.filter((i) => !stage || i.stage === stage).slice(-150).reverse().map((it) => {
            const st = flow.stages.find((s) => s.value === it.stage)
            const sel = selected?.kind === 'item' && selected.key === it.key
            return (
              <button key={it.key} onClick={() => focusSelection({ kind: 'item', key: it.key })} className={`flex w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left ${sel ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-white/70'}`}>
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: st?.color }} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-800">{it.title}</span>
                  <span className="block truncate text-[11px] text-slate-500">{st?.label ?? it.stage}{flow.def.titleField !== flow.def.idField ? ` · ${it.id}` : ''}</span>
                </span>
                {it.value !== null && <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-600">{formatValue(it.value, flow.def.valueFormat ?? 'number')}</span>}
              </button>
            )
          })}
        {stock &&
          [...stock.items].sort((a, b) => a.qty - b.qty).map((it) => {
            const sel = selected?.kind === 'stockItem' && selected.key === it.key
            const max = Math.max(1, ...stock.items.map((i) => i.qty))
            return (
              <button key={it.key} onClick={() => focusSelection({ kind: 'stockItem', key: it.key })} className={`flex w-full items-center gap-3 rounded-xl px-3 py-1.5 text-left ${sel ? 'bg-blue-50 ring-1 ring-blue-200' : 'hover:bg-white/70'}`}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold text-slate-800">{it.title}</span>
                  <span className="block truncate text-[11px] text-slate-500">{it.group}</span>
                </span>
                <span className="w-20 shrink-0">
                  <span className="mb-0.5 block text-right text-[11px] font-bold tabular-nums text-slate-600">{it.qty.toLocaleString('pt-BR')} {stock.def.unit ?? ''}</span>
                  <span className="block h-1.5 overflow-hidden rounded-full bg-slate-200"><span className={`block h-full rounded-full ${it.low ? 'bg-rose-500' : 'bg-emerald-500'}`} style={{ width: `${(it.qty / max) * 100}%` }} /></span>
                </span>
              </button>
            )
          })}
        {current === 'events' && (
          <ul className="space-y-0.5 px-1">
            {events.length === 0 && <li className="px-2 py-6 text-center text-xs text-slate-400">As mudanças nos dados aparecem aqui.</li>}
            {events.map((e) => (
              <li key={e.id} className="flex items-start gap-2.5 rounded-lg px-2 py-1.5 text-xs">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full" style={{ background: e.color }} />
                <span className="w-14 shrink-0 tabular-nums text-slate-400">{e.time}</span>
                <span className="text-slate-700">{e.text}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

// ------------------------------------------------------------------ detail panel (right)

export function UDetail() {
  const selected = useUniverse((s) => s.selected)
  const inside = useUniverse((s) => s.inside)
  useUniverse((s) => s.version)
  const s = useUniverse.getState()
  if (!selected) return null

  let icon: IconName = 'box'
  let kind = ''
  let title = ''
  let badge: { label: string; color: string } | null = null
  let hero: { label: string; value: string } | null = null
  let rows: [string, string][] = []
  let list: { key: string; label: string; sub: string; onClick: () => void }[] = []
  let buildingId: string | null = null

  if (selected.kind === 'building') {
    const b = s.layout.buildings[selected.id]
    if (!b) return null
    buildingId = b.id
    title = b.label
    icon = b.kind === 'hq' ? 'site' : b.kind === 'stock' ? 'dock' : 'box'
    if (b.kind === 'stage') {
      const flow = s.model.flows.find((f) => f.def.id === b.flowId)!
      const items = flow.items.filter((i) => i.stage === b.stage)
      const sum = items.reduce((a, i) => a + (i.value ?? 0), 0)
      kind = `Etapa · ${flow.def.label}`
      badge = { label: `${items.length} registros`, color: b.color }
      hero = flow.def.valueField ? { label: 'Valor nesta etapa', value: formatValue(sum, flow.def.valueFormat ?? 'number') } : { label: 'Registros', value: String(items.length) }
      const cap = b.bays * b.rows * 3
      rows = [
        ['Registros nesta etapa', items.length.toLocaleString('pt-BR')],
        ['Nas estantes', `${Math.min(items.length, cap)} de ${cap} posições${items.length > cap ? ` (estantes cheias, +${(items.length - cap).toLocaleString('pt-BR')})` : ''}`],
        ['Participação', `${((items.length / Math.max(1, flow.items.length)) * 100).toFixed(1)}% de ${flow.def.label.toLowerCase()}`],
        ['A caminho', String(Object.values(s.transit).filter((t) => t.to === b.id).length)],
      ]
      list = items.slice(-8).reverse().map((it) => ({ key: it.key, label: it.title, sub: it.value !== null ? formatValue(it.value, flow.def.valueFormat ?? 'number') : it.id, onClick: () => focusSelection({ kind: 'item', key: it.key }) }))
    } else if (b.kind === 'stock') {
      const st = s.model.stocks.find((x) => x.def.id === b.stockId)!
      kind = 'Armazém · estoque'
      hero = { label: 'Total em estoque', value: `${st.total.toLocaleString('pt-BR')} ${st.def.unit ?? 'un.'}` }
      rows = [
        ['Itens', String(st.items.length)],
        ['Grupos', st.groups.join(', ')],
        ['1 palete =', `${s.palletUnits[st.def.id]} ${st.def.unit ?? 'un.'}`],
        ['Itens em alerta', String(st.items.filter((i) => i.low).length)],
      ]
      list = [...st.items].sort((a, b2) => a.qty - b2.qty).slice(0, 8).map((it) => ({ key: it.key, label: it.title, sub: `${it.qty.toLocaleString('pt-BR')}${it.low ? ' · baixo' : ''}`, onClick: () => focusSelection({ kind: 'stockItem', key: it.key }) }))
    } else {
      kind = 'Prédio principal'
      hero = { label: 'Indicadores', value: `${s.model.kpis.length}` }
      rows = s.model.kpis.map((k) => [k.label, formatValue(k.value, k.format)])
    }
  } else if (selected.kind === 'truck') {
    const t = fleet.trucks.find((v) => String(v.id) === selected.key)
    icon = 'truck'
    kind = 'Caminhão'
    title = `Caminhão ${selected.key.padStart(3, '0')}`
    if (!t) {
      badge = { label: 'Saiu do site', color: '#64748b' }
    } else {
      const L = s.layout.buildings
      badge = { label: PHASE_LABEL[t.phase], color: '#2563eb' }
      hero = { label: 'Carga', value: t.keys.length ? `${t.keys.length} registro${t.keys.length > 1 ? 's' : ''}` : `${t.stockTrips} palete(s)` }
      rows = [
        ['Origem', t.from ? L[t.from]?.label ?? '—' : 'Entrada do site'],
        ['Destino', t.to ? L[t.to]?.label ?? '—' : 'Saída do site'],
        ['Rua', s.layout.roads.find((r) => r.id === t.road)?.label ?? t.road],
      ]
      const titles = new Map(s.model.flows.flatMap((f) => f.items.map((i) => [i.key, i.title] as const)))
      list = t.keys.slice(0, 10).map((k) => ({ key: k, label: titles.get(k) ?? k, sub: 'na carga', onClick: () => focusSelection({ kind: 'item', key: k }) }))
    }
  } else if (selected.kind === 'item') {
    const flow = s.model.flows.find((f) => f.items.some((i) => i.key === selected.key))
    const it = flow?.items.find((i) => i.key === selected.key)
    if (!flow || !it) return null
    const st = flow.stages.find((x) => x.value === it.stage)
    buildingId = `stage:${flow.def.id}:${it.stage}`
    icon = 'box'
    kind = flow.def.label
    title = it.title
    badge = { label: st?.label ?? it.stage, color: st?.color ?? '#64748b' }
    if (it.value !== null) hero = { label: flow.def.valueField ?? 'Valor', value: formatValue(it.value, flow.def.valueFormat ?? 'number') }
    const fields = flow.def.details ?? Object.keys(it.raw)
    rows = fields.map((f) => [f, displayValue(getPath(it.raw, f))])
    if (s.transit[it.key]) rows.unshift(['Situação', 'a caminho da etapa'])
  } else {
    const stock = s.model.stocks.find((x) => x.items.some((i) => i.key === selected.key))
    const it = stock?.items.find((i) => i.key === selected.key)
    if (!stock || !it) return null
    buildingId = `stock:${stock.def.id}`
    icon = 'dock'
    kind = `${stock.def.label} · ${it.group}`
    title = it.title
    badge = it.low ? { label: 'Estoque baixo', color: '#e11d48' } : { label: 'OK', color: '#059669' }
    hero = { label: 'Quantidade', value: `${it.qty.toLocaleString('pt-BR')} ${stock.def.unit ?? ''}` }
    rows = (stock.def.details ?? Object.keys(it.raw)).map((f) => [f, displayValue(getPath(it.raw, f))])
  }

  const isInside = buildingId !== null && inside === buildingId
  const canEnter = buildingId === 'hq'
  return (
    <aside className="glass pointer-events-auto absolute right-4 top-[92px] z-20 flex max-h-[calc(100vh-92px-324px)] min-h-[200px] w-[340px] flex-col overflow-hidden">
      <div className="flex items-start gap-3 border-b border-slate-200/70 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-500/25"><Icon name={icon} className="h-5 w-5" /></span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[11px] font-semibold uppercase tracking-wide text-slate-400">{kind}</div>
          <h2 className="truncate text-lg font-extrabold text-slate-900">{title}</h2>
          {badge && <span className="mt-0.5 inline-flex rounded-full px-2 py-0.5 text-[11px] font-semibold text-white" style={{ background: badge.color }}>{badge.label}</span>}
        </div>
        <button onClick={() => s.select(null)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700" title="Fechar"><Icon name="x" /></button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {hero && (
          <div className="mb-3 flex items-baseline justify-between gap-2 rounded-xl bg-white/70 p-3">
            <span className="truncate text-xs text-slate-500">{hero.label}</span>
            <span className="text-lg font-extrabold tabular-nums text-slate-900">{hero.value}</span>
          </div>
        )}
        <dl className="space-y-2">
          {rows.map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-3 text-[13px]">
              <dt className="shrink-0 text-slate-500">{k}</dt>
              <dd className="break-all text-right font-medium text-slate-800">{v}</dd>
            </div>
          ))}
        </dl>
        {list.length > 0 && (
          <div className="mt-3 border-t border-slate-200/70 pt-2">
            {list.map((l) => (
              <button key={l.key} onClick={l.onClick} className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs hover:bg-white/70">
                <span className="truncate font-semibold text-slate-700">{l.label}</span>
                <span className="shrink-0 tabular-nums text-slate-500">{l.sub}</span>
              </button>
            ))}
          </div>
        )}
      </div>
      {buildingId && (
        <div className="flex gap-2 border-t border-slate-200/70 p-3">
          <button
            onClick={() => (!canEnter ? focusSelection(selected) : isInside ? s.exit() : s.enter(buildingId!))}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-blue-600 py-2 text-sm font-semibold text-white shadow-md shadow-blue-600/25 hover:bg-blue-700"
          >
            <Icon name={isInside ? 'x' : canEnter ? 'home' : 'target'} /> {!canEnter ? 'Ver de perto' : isInside ? 'Sair do prédio' : 'Entrar no prédio'}
          </button>
          <button onClick={() => focusSelection(selected)} title="Focar câmera" className="grid w-10 place-items-center rounded-xl bg-white/80 text-slate-600 hover:text-blue-600"><Icon name="target" /></button>
        </div>
      )}
    </aside>
  )
}

// ------------------------------------------------------------------ small bits

export function InsideBanner() {
  const inside = useUniverse((s) => s.inside)
  const b = useUniverse((s) => (s.inside ? s.layout.buildings[s.inside] : null))
  const count = useUniverse((s) => (s.inside ? s.counts[s.inside] : 0))
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') useUniverse.getState().exit() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  if (!inside || !b) return null
  return (
    <div className="glass pointer-events-auto absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 py-2 pl-3 pr-2">
      <span className="h-2.5 w-2.5 rounded-full" style={{ background: b.color }} />
      <span className="text-sm text-slate-700">
        Dentro de <span className="font-bold text-slate-900">{b.label}</span>
        {b.kind === 'stage' && <span className="ml-1.5 text-xs text-slate-400">{count} registros</span>}
      </span>
      <button onClick={() => useUniverse.getState().exit()} className="flex items-center gap-1 rounded-lg bg-slate-900/5 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-900/10">
        <Icon name="x" className="h-3.5 w-3.5" /> Sair <kbd className="ml-1 text-[10px] text-slate-400">Esc</kbd>
      </button>
    </div>
  )
}

export function UTooltip() {
  const ref = useRef<HTMLDivElement>(null)
  const hovered = useUniverse((s) => s.hovered)
  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (ref.current) ref.current.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 14}px)`
    }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [])
  return (
    <div ref={ref} className="pointer-events-none fixed left-0 top-0 z-50" style={{ visibility: hovered ? 'visible' : 'hidden' }}>
      <div className="max-w-72 rounded-lg bg-slate-900/90 px-2.5 py-1.5 text-white shadow-lg backdrop-blur">
        <div className="truncate text-xs font-bold">{hovered?.label}</div>
        {hovered?.sub && <div className="text-[11px] text-slate-300">{hovered.sub}</div>}
      </div>
    </div>
  )
}

export function UCameraButtons() {
  const buttons: { icon: IconName; title: string; cmd: 'zoomIn' | 'zoomOut' | 'rotateLeft' | 'rotateRight' | 'reset' }[] = [
    { icon: 'plus', title: 'Aproximar', cmd: 'zoomIn' },
    { icon: 'minus', title: 'Afastar', cmd: 'zoomOut' },
    { icon: 'rotL', title: 'Girar à esquerda', cmd: 'rotateLeft' },
    { icon: 'rotR', title: 'Girar à direita', cmd: 'rotateRight' },
    { icon: 'home', title: 'Ver tudo', cmd: 'reset' },
  ]
  return (
    <div className="glass pointer-events-auto absolute left-4 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1 p-1.5">
      {buttons.map((b, i) => (
        <button
          key={b.cmd}
          title={b.title}
          onClick={() => { if (b.cmd === 'reset') useUniverse.getState().exit(); useUniverse.getState().cameraCmd({ type: b.cmd }) }}
          className={`grid h-9 w-9 place-items-center rounded-xl text-slate-600 transition hover:bg-white hover:text-blue-600 ${i === 2 ? 'mt-1 border-t border-slate-200/80 pt-1' : ''}`}
        >
          <Icon name={b.icon} />
        </button>
      ))}
    </div>
  )
}
