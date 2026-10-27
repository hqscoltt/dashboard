// Global UI/simulation snapshot. The 3D scene never subscribes to the fast-changing
// parts of this store (positions live in the engine and are read inside useFrame),
// so ticks only re-render the HUD.
import { create } from 'zustand'
import type {
  ActivityEvent, DockView, ForkliftView, KpiHistory, Kpis, Selection, SelectionKind, TruckView,
} from '../data/types'

export type Speed = 1 | 2 | 4

export type CameraCommand =
  | { type: 'zoomIn' | 'zoomOut' | 'reset' | 'rotateLeft' | 'rotateRight'; nonce: number }
  | { type: 'focus'; x: number; z: number; follow?: Selection; nonce: number }

type CameraInput = CameraCommand extends infer C ? (C extends CameraCommand ? Omit<C, 'nonce'> : never) : never

export interface Hover {
  label: string
  kind?: SelectionKind
  id?: string
}

interface SimState {
  warehouseId: string
  loading: boolean
  paused: boolean
  speed: Speed
  dayNight: boolean
  clock: string
  dateLabel: string
  hour: number

  version: number
  trucks: TruckView[]
  forklifts: ForkliftView[]
  docks: DockView[]
  kpis: Kpis
  baseline: Kpis
  history: KpiHistory
  events: ActivityEvent[]

  selected: Selection | null
  hovered: Hover | null
  camera: CameraCommand | null
  /** Moving object the camera is currently tracking. */
  following: Selection | null

  setWarehouse: (id: string) => void
  togglePause: () => void
  setSpeed: (s: Speed) => void
  toggleDayNight: () => void
  select: (sel: Selection | null) => void
  setHovered: (h: Hover | null) => void
  cameraCmd: (cmd: CameraInput) => void
  stopFollowing: () => void
}

const emptyKpis: Kpis = { inventory: 0, capacity: 1, trucksInYard: 0, onTimePct: 0 }

export const useSim = create<SimState>()((set) => ({
  warehouseId: 'riverside',
  loading: true,
  paused: false,
  speed: 1,
  dayNight: false,
  clock: '07:30',
  dateLabel: '',
  hour: 7.5,

  version: 0,
  trucks: [],
  forklifts: [],
  docks: [],
  kpis: emptyKpis,
  baseline: emptyKpis,
  history: { inventory: [], trucksInYard: [], onTimePct: [] },
  events: [],

  selected: null,
  hovered: null,
  camera: null,
  following: null,

  setWarehouse: (id) => set({ warehouseId: id, selected: null }),
  togglePause: () => set((s) => ({ paused: !s.paused })),
  setSpeed: (speed) => set({ speed, paused: false }),
  toggleDayNight: () => set((s) => ({ dayNight: !s.dayNight })),
  select: (selected) => set({ selected }),
  setHovered: (hovered) => set({ hovered }),
  cameraCmd: (cmd) => set({ camera: { ...cmd, nonce: Math.random() } as CameraCommand }),
  stopFollowing: () => set({ following: null }),
}))
