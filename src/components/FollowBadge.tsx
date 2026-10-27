import { useSim } from '../store/useSimStore'
import { Icon } from './Icon'

/** Shows which vehicle the camera is tracking, with a button to release it. */
export function FollowBadge() {
  const following = useSim((s) => s.following)
  if (!following) return null
  return (
    <div className="glass pointer-events-auto absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 py-2 pl-3 pr-2">
      <span className="relative flex h-2.5 w-2.5">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cyan-400 opacity-75" />
        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cyan-500" />
      </span>
      <span className="text-sm text-slate-700">
        Seguindo <span className="font-bold text-slate-900">{following.id}</span>
        <span className="ml-1.5 text-xs text-slate-400">arraste o mapa para soltar</span>
      </span>
      <button
        onClick={() => useSim.getState().stopFollowing()}
        className="flex items-center gap-1 rounded-lg bg-slate-900/5 px-2 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-900/10"
      >
        <Icon name="x" className="h-3.5 w-3.5" /> Parar
      </button>
    </div>
  )
}
