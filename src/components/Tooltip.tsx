import { useEffect, useRef } from 'react'
import { useSim } from '../store/useSimStore'
import { DOCK_STATUS, FORKLIFT_STATUS, TRUCK_STATUS } from './format'

/** Follows the mouse without React re-renders; content comes from the hovered object. */
export function Tooltip() {
  const ref = useRef<HTMLDivElement>(null)
  const hovered = useSim((s) => s.hovered)
  const sub = useSim((s) => {
    const h = s.hovered
    if (!h?.id) return ''
    if (h.kind === 'truck') { const t = s.trucks.find((x) => x.id === h.id); return t ? `${TRUCK_STATUS[t.status].label} · ${t.carrier}` : '' }
    if (h.kind === 'forklift') { const f = s.forklifts.find((x) => x.id === h.id); return f ? `${FORKLIFT_STATUS[f.status].label} · ${f.operator}` : '' }
    if (h.kind === 'dock') { const d = s.docks.find((x) => x.id === h.id); return d ? `${DOCK_STATUS[d.status].label}${d.truckId ? ` · ${d.truckId}` : ''}` : '' }
    return 'Clique para ver detalhes'
  })

  useEffect(() => {
    const move = (e: PointerEvent) => {
      if (ref.current) ref.current.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 14}px)`
    }
    window.addEventListener('pointermove', move)
    return () => window.removeEventListener('pointermove', move)
  }, [])

  return (
    <div ref={ref} className="pointer-events-none fixed left-0 top-0 z-50" style={{ visibility: hovered ? 'visible' : 'hidden' }}>
      <div className="rounded-lg bg-slate-900/90 px-2.5 py-1.5 text-white shadow-lg backdrop-blur">
        <div className="text-xs font-bold">{hovered?.label}</div>
        {sub && <div className="text-[11px] text-slate-300">{sub}</div>}
      </div>
    </div>
  )
}
