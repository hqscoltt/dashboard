import type { ReactNode } from 'react'
import { BAY_NAMES } from '../data/layout'
import { RESPONSIBLES } from '../data/mockData'
import type { Selection } from '../data/types'
import { engine } from '../simulation/engine'
import { useSim } from '../store/useSimStore'
import { focusOn } from './actions'
import { Badge, DOCK_STATUS, FORKLIFT_STATUS, TRUCK_STATUS, truckLocation } from './format'
import { Icon, type IconName } from './Icon'

interface Detail {
  icon: IconName
  kindLabel: string
  title: string
  badge?: { label: string; cls: string }
  hero?: { label: string; value: string; pct?: number }
  rows: [string, ReactNode][]
  color?: string
}

function buildDetail(sel: Selection, s: ReturnType<typeof useSim.getState>): Detail | null {
  switch (sel.kind) {
    case 'truck': {
      const t = s.trucks.find((x) => x.id === sel.id)
      if (!t) return null
      return {
        icon: 'truck',
        kindLabel: t.type === 'outbound' ? 'Caminhão · Expedição' : 'Caminhão · Recebimento',
        title: t.id,
        badge: TRUCK_STATUS[t.status],
        hero: {
          label: t.type === 'outbound' ? 'Paletes carregados' : 'Paletes descarregados',
          value: t.type === 'outbound' ? `${t.cargo} / ${t.target}` : `${t.qty - t.cargo} / ${t.qty}`,
          pct: t.progress,
        },
        rows: [
          ['Localização', truckLocation(t)],
          ['Placa', t.plate],
          ['Transportadora', t.carrier],
          ['Pedido', t.orderId],
          ['Lote', t.lot],
          ['Origem → destino', `${t.origin} → ${t.destination}`],
          ['Recebimento', t.arrivedAt ? `${s.dateLabel} · ${t.arrivedAt}` : 'Ainda não chegou'],
          ['Responsável', `${t.driver} (motorista)`],
        ],
      }
    }
    case 'forklift': {
      const f = s.forklifts.find((x) => x.id === sel.id)
      const sim = engine.forklifts.find((x) => x.v.id === sel.id)
      if (!f) return null
      return {
        icon: 'forklift',
        kindLabel: `Empilhadeira · ${f.model}`,
        title: f.id,
        badge: FORKLIFT_STATUS[f.status],
        hero: { label: 'Bateria', value: `${f.battery}%`, pct: f.battery / 100 },
        color: f.battery < 30 ? 'from-rose-500 to-amber-400' : 'from-emerald-500 to-lime-400',
        rows: [
          ['Localização', f.location],
          ['Carga atual', sim?.cargo ? `${sim.cargo.id} · ${sim.cargo.product}` : 'Vazia'],
          ['Lote', sim?.cargo?.lot ?? '—'],
          ['Quantidade', sim?.cargo ? `${sim.cargo.qty} volumes` : '—'],
          ['Atendendo', f.truckId ?? '—'],
          ['Movimentações no turno', String(f.tasksDone)],
          ['Recebimento', s.dateLabel],
          ['Responsável', `${f.operator} (operador)`],
        ],
      }
    }
    case 'pallet': {
      const { pos, meta, reserved } = engine.slotInfo(Number(sel.id))
      if (!meta) {
        return {
          icon: 'box', kindLabel: 'Posição de estoque', title: pos.label,
          badge: { label: reserved ? 'Reservada' : 'Vazia', cls: reserved ? 'bg-amber-100 text-amber-700' : 'bg-slate-100 text-slate-600' },
          rows: [['Localização', `Rack ${pos.label} · nível ${pos.level + 1}`], ['Status', reserved ? 'Aguardando palete de recebimento' : 'Disponível para armazenagem']],
        }
      }
      return {
        icon: 'box',
        kindLabel: 'Palete',
        title: meta.id,
        badge: reserved ? { label: 'Separação', cls: 'bg-amber-100 text-amber-700' } : { label: 'Armazenado', cls: 'bg-emerald-100 text-emerald-700' },
        hero: { label: meta.product, value: `${meta.qty} vol.` },
        rows: [
          ['SKU', meta.sku],
          ['Quantidade', `${meta.qty} volumes`],
          ['Localização', `Rack ${pos.label} · nível ${pos.level + 1}`],
          ['Lote', meta.lot],
          ['Recebimento', meta.receivedAt],
          ['Responsável', meta.responsible],
        ],
      }
    }
    case 'dock': {
      const d = s.docks.find((x) => x.id === sel.id)
      if (!d) return null
      const t = s.trucks.find((x) => x.id === d.truckId)
      return {
        icon: 'dock',
        kindLabel: 'Doca de carga',
        title: d.name,
        badge: DOCK_STATUS[d.status],
        hero: t ? { label: `${t.id} · ${TRUCK_STATUS[t.status].label}`, value: `${Math.round(t.progress * 100)}%`, pct: t.progress } : undefined,
        rows: [
          ['Veículo', t ? `${t.id} · ${t.plate}` : 'Nenhum'],
          ['Quantidade', t ? `${t.type === 'outbound' ? t.cargo : t.qty - t.cargo} de ${t.qty} paletes` : '—'],
          ['Lote', t?.lot ?? '—'],
          ['Movimentações hoje', String(d.movesToday)],
          ['Localização', `Fachada sul · ${BAY_NAMES[d.index]}`],
          ['Recebimento', t?.arrivedAt ? `${s.dateLabel} · ${t.arrivedAt}` : '—'],
          ['Responsável', RESPONSIBLES[(d.index + 3) % RESPONSIBLES.length]],
        ],
      }
    }
  }
}

export function DetailPanel() {
  const sel = useSim((s) => s.selected)
  const following = useSim((s) => s.following)
  useSim((s) => s.version) // refresh with every simulation commit
  if (!sel) return null
  const d = buildDetail(sel, useSim.getState())
  if (!d) return null

  return (
    <aside className="glass pointer-events-auto absolute right-4 top-[92px] z-20 flex max-h-[calc(100vh-92px-320px)] min-h-[200px] w-[340px] flex-col overflow-hidden">
      <div className="flex items-start gap-3 border-b border-slate-200/70 p-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-blue-500 to-cyan-500 text-white shadow-md shadow-blue-500/25">
          <Icon name={d.icon} className="h-5 w-5" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{d.kindLabel}</div>
          <div className="flex items-center gap-2">
            <h2 className="truncate text-lg font-extrabold text-slate-900">{d.title}</h2>
            {d.badge && <Badge cls={d.badge.cls}>{d.badge.label}</Badge>}
          </div>
        </div>
        <button onClick={() => useSim.getState().select(null)} className="grid h-7 w-7 place-items-center rounded-lg text-slate-400 hover:bg-white hover:text-slate-700" title="Fechar">
          <Icon name="x" />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-4 scrollbar-thin">
        {d.hero && (
          <div className="mb-3 rounded-xl bg-white/70 p-3">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-xs text-slate-500">{d.hero.label}</span>
              <span className="text-lg font-extrabold tabular-nums text-slate-900">{d.hero.value}</span>
            </div>
            {d.hero.pct !== undefined && (
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                <div className={`h-full rounded-full bg-gradient-to-r ${d.color ?? 'from-blue-500 to-cyan-400'} transition-all duration-500`} style={{ width: `${Math.round(d.hero.pct * 100)}%` }} />
              </div>
            )}
          </div>
        )}
        <dl className="space-y-2">
          {d.rows.map(([k, v]) => (
            <div key={k} className="flex items-start justify-between gap-3 text-[13px]">
              <dt className="shrink-0 text-slate-500">{k}</dt>
              <dd className="text-right font-medium text-slate-800">{v}</dd>
            </div>
          ))}
        </dl>
      </div>
      <div className="border-t border-slate-200/70 p-3">
        <button onClick={() => focusOn(sel)} className="flex w-full items-center justify-center gap-2 rounded-xl bg-blue-600 py-2 text-sm font-semibold text-white shadow-md shadow-blue-600/25 hover:bg-blue-700">
          <Icon name="target" /> {following && following.id === sel.id ? 'Seguindo…' : sel.kind === 'truck' || sel.kind === 'forklift' ? 'Seguir com a câmera' : 'Focar câmera'}
        </button>
      </div>
    </aside>
  )
}
