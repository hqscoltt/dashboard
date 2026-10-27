import { create } from 'zustand'

export type AppMode = 'universal' | 'logistica'

function initialMode(): AppMode {
  try {
    return localStorage.getItem('Trycol:mode') === 'logistica' ? 'logistica' : 'universal'
  } catch {
    return 'universal'
  }
}

/** Which dashboard is on screen: the universal engine or the specialised logistics yard. */
export const useApp = create<{ mode: AppMode; setMode: (m: AppMode) => void }>()((set) => ({
  mode: initialMode(),
  setMode: (mode) => {
    try {
      localStorage.setItem('Trycol:mode', mode)
    } catch {
      /* ignore */
    }
    set({ mode })
  },
}))
