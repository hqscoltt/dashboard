import { useSim } from '../store/useSimStore'
import { Icon, type IconName } from './Icon'

const BUTTONS: { icon: IconName; title: string; cmd: 'zoomIn' | 'zoomOut' | 'rotateLeft' | 'rotateRight' | 'reset' }[] = [
  { icon: 'plus', title: 'Aproximar', cmd: 'zoomIn' },
  { icon: 'minus', title: 'Afastar', cmd: 'zoomOut' },
  { icon: 'rotL', title: 'Girar à esquerda', cmd: 'rotateLeft' },
  { icon: 'rotR', title: 'Girar à direita', cmd: 'rotateRight' },
  { icon: 'home', title: 'Resetar câmera', cmd: 'reset' },
]

export function CameraControls() {
  return (
    <div className="glass pointer-events-auto absolute left-4 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1 p-1.5">
      {BUTTONS.map((b, i) => (
        <button
          key={b.cmd}
          title={b.title}
          onClick={() => useSim.getState().cameraCmd({ type: b.cmd })}
          className={`grid h-9 w-9 place-items-center rounded-xl text-slate-600 transition hover:bg-white hover:text-blue-600 ${i === 2 ? 'mt-1 border-t border-slate-200/80 pt-1' : ''}`}
        >
          <Icon name={b.icon} />
        </button>
      ))}
    </div>
  )
}
