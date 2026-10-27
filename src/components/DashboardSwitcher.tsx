import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { useApp } from '../store/useApp'
import { PRESETS } from '../universal/presets'
import { useUniverse } from '../universal/store'
import { Icon } from './Icon'

/** Picks which dashboard is shown: universal presets, the user's own data, or the logistics yard. */
export function DashboardSwitcher() {
  const [open, setOpen] = useState(false)
  const mode = useApp((s) => s.mode)
  const { source, presetId, name } = useUniverse(useShallow((s) => ({ source: s.source, presetId: s.presetId, name: s.mapping.name })))
  const label = mode === 'logistica' ? 'Logística · Galpão' : source === 'preset' ? PRESETS.find((p) => p.id === presetId)?.label : name

  const pick = (fn: () => void) => {
    fn()
    setOpen(false)
  }

  return (
    <div className="relative">
      <button onClick={() => setOpen((o) => !o)} className="flex items-center gap-2 rounded-xl border border-slate-200/80 bg-white/80 px-3 py-1.5 text-left hover:bg-white">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-blue-100 text-blue-700"><Icon name="site" /></span>
        <span className="max-w-44">
          <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">Painel</span>
          <span className="block truncate text-sm font-semibold leading-tight text-slate-800">{label}</span>
        </span>
        <Icon name="chevron" className="h-4 w-4 text-slate-400" />
      </button>
      {open && (
        <div className="glass absolute left-0 top-14 z-50 w-80 p-1.5">
          <div className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-slate-400">Exemplos (motor universal)</div>
          {PRESETS.map((p) => (
            <button
              key={p.id}
              onClick={() => pick(() => { useApp.getState().setMode('universal'); useUniverse.getState().loadPreset(p.id) })}
              className={`block w-full rounded-lg px-3 py-2 text-left hover:bg-blue-50 ${mode === 'universal' && source === 'preset' && presetId === p.id ? 'bg-blue-50' : ''}`}
            >
              <span className="block text-sm font-semibold text-slate-800">{p.label}</span>
              <span className="block text-xs text-slate-500">{p.description}</span>
            </button>
          ))}
          <button
            onClick={() => pick(() => { useApp.getState().setMode('universal'); useUniverse.getState().setPanelOpen(true) })}
            className={`block w-full rounded-lg px-3 py-2 text-left hover:bg-blue-50 ${mode === 'universal' && source !== 'preset' ? 'bg-blue-50' : ''}`}
          >
            <span className="block text-sm font-semibold text-slate-800">Meus dados…</span>
            <span className="block text-xs text-slate-500">Arquivo JSON/CSV ou API do seu sistema</span>
          </button>
          <div className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-wider text-slate-400">Tema especializado</div>
          <button
            onClick={() => pick(() => useApp.getState().setMode('logistica'))}
            className={`block w-full rounded-lg px-3 py-2 text-left hover:bg-blue-50 ${mode === 'logistica' ? 'bg-blue-50' : ''}`}
          >
            <span className="block text-sm font-semibold text-slate-800">Logística · Galpão 3D</span>
            <span className="block text-xs text-slate-500">Caminhões, docas e empilhadeiras (simulação)</span>
          </button>
        </div>
      )}
    </div>
  )
}
