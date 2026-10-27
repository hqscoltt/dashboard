// Domain types shared by the data layer, the simulation, the store and the UI.
// A real API only needs to produce objects matching these shapes.

export type Vec2 = { x: number; z: number }

export type TruckType = 'inbound' | 'outbound'

export type TruckStatus =
  | 'em_transito' // on the highway, heading to the site
  | 'chegando' // driving inside the yard
  | 'aguardando' // parked, waiting for a free dock
  | 'docado' // backed into a bay, doors opening / picking
  | 'carregando'
  | 'descarregando'
  | 'saindo'
  | 'em_rota' // left the site, travelling to destination
  | 'entregue'

export type ForkliftStatus =
  | 'ocioso'
  | 'indo_coletar'
  | 'elevando'
  | 'transportando'
  | 'baixando'
  | 'retornando'
  | 'recarregando'

export type DockStatus = 'livre' | 'reservada' | 'ocupada'

export type SelectionKind = 'truck' | 'forklift' | 'pallet' | 'dock'

export interface Selection {
  kind: SelectionKind
  id: string
}

export interface WarehouseTheme {
  accent: string // trims, signs, logo
  ground: string // terrain around the site
  yard: string // yard concrete
  trees: [string, string, string]
}

export interface Warehouse {
  id: string
  name: string
  city: string
  fillRatio: number // initial rack occupancy 0..1
  seed: number
  onTimeBase: { onTime: number; total: number }
  theme: WarehouseTheme
}

export interface Product {
  sku: string
  name: string
  color: string
}

export interface PalletMeta {
  id: string
  sku: string
  product: string
  qty: number
  lot: string
  receivedAt: string
  responsible: string
  color: string
}

export interface TruckView {
  id: string
  plate: string
  carrier: string
  driver: string
  type: TruckType
  status: TruckStatus
  bay: number | null
  parking: number | null
  qty: number
  cargo: number
  target: number
  progress: number // 0..1 loading/unloading progress
  eta: number // sim seconds to arrival (em_transito) or to delivery (em_rota)
  orderId: string
  lot: string
  origin: string
  destination: string
  arrivedAt: string | null
  onTime: boolean | null
}

export interface ForkliftView {
  id: string
  model: string
  operator: string
  status: ForkliftStatus
  battery: number
  tasksDone: number
  carrying: boolean
  truckId: string | null
  location: string
}

export interface DockView {
  id: string
  index: number
  name: string
  status: DockStatus
  truckId: string | null
  movesToday: number
}

export interface Kpis {
  inventory: number
  capacity: number
  trucksInYard: number
  onTimePct: number
}

export interface KpiHistory {
  inventory: number[]
  trucksInYard: number[]
  onTimePct: number[]
}

export interface ActivityEvent {
  id: number
  time: string
  text: string
  tone: 'info' | 'success' | 'warn'
}
