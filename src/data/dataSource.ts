// The only seam between Trycol and "where the data comes from".
// The simulation engine talks exclusively to a LogisticsDataSource; swap
// `mockDataSource` for an API-backed implementation (see apiDataSource.example.ts).
import type { PalletMeta, TruckType, Warehouse } from './types'
import {
  CARRIERS, CITIES, DRIVERS, FORKLIFT_MODELS, OPERATORS, PRODUCTS, RESPONSIBLES,
  SIM_START, WAREHOUSES, createRng, formatDate, makePlate, type Rng,
} from './mockData'
import { SLOT_COUNT, slotPosition } from './layout'

export interface TruckSeed {
  id: string
  plate: string
  carrier: string
  driver: string
  type: TruckType
  /** Pallets to load (outbound) or pallets on board (inbound). */
  qty: number
  orderId: string
  lot: string
  origin: string
  destination: string
  /** Sim seconds until the truck reaches the site gate. */
  eta: number
  /** Optional: place the truck directly at a bay when the site loads. */
  startDocked?: { bay: number; done: number }
}

export interface ForkliftSeed {
  id: string
  model: string
  operator: string
  battery: number
}

export interface InitialState {
  warehouse: Warehouse
  slots: (PalletMeta | null)[]
  forklifts: ForkliftSeed[]
  trucks: TruckSeed[]
}

export type DataEvent = { type: 'truck_scheduled'; truck: TruckSeed }

export interface PollContext {
  /** Sim seconds since the site was loaded. */
  time: number
  scheduledTrucks: number
  trucksOnSite: number
  /** Rack occupancy 0..1 — the mock uses it to balance inbound vs outbound trucks. */
  fill: number
}

export interface LogisticsDataSource {
  listWarehouses(): Warehouse[]
  load(warehouseId: string): Promise<InitialState>
  /** Called once per simulation tick; return any new events since the last call. */
  poll(ctx: PollContext): DataEvent[]
  /** Metadata for a pallet unloaded from an inbound truck into the racks. */
  createPallet(ctx: { time: number; responsible: string; lot: string }): PalletMeta
}

// ---------------------------------------------------------------------------
// Mock implementation
// ---------------------------------------------------------------------------

let rng: Rng = createRng(1)
let truckSeq = 1040
let siteName = 'Riverside Hub'
let palletSeq = 50210

function simDate(time: number) {
  return new Date(SIM_START.getTime() + time * 60_000)
}

function randomPallet(r: Rng, receivedAt: Date, responsible?: string, lot?: string): PalletMeta {
  const p = r.pick(PRODUCTS)
  return {
    id: `PLT-${palletSeq++}`,
    sku: p.sku,
    product: p.name,
    qty: r.int(12, 60),
    lot: lot ?? `L${r.int(2601, 2610)}-${r.int(100, 999)}`,
    receivedAt: formatDate(receivedAt),
    responsible: responsible ?? r.pick(RESPONSIBLES),
    color: p.color,
  }
}

function randomTruck(r: Rng, eta: number, type?: TruckType, fill = 0.7): TruckSeed {
  const t: TruckType = type ?? (r.chance(0.2 + fill * 0.55) ? 'outbound' : 'inbound')
  const site = siteName
  const city = r.pick(CITIES)
  return {
    id: `TRK-${truckSeq++}`,
    plate: makePlate(r),
    carrier: r.pick(CARRIERS),
    driver: r.pick(DRIVERS),
    type: t,
    qty: r.int(4, 9),
    orderId: `${t === 'outbound' ? 'SO' : 'PO'}-${r.int(88000, 89999)}`,
    lot: `L2610-${r.int(100, 999)}`,
    origin: t === 'outbound' ? site : city,
    destination: t === 'outbound' ? city : site,
    eta,
  }
}

export const mockDataSource: LogisticsDataSource = {
  listWarehouses: () => WAREHOUSES,

  async load(warehouseId) {
    const warehouse = WAREHOUSES.find((w) => w.id === warehouseId) ?? WAREHOUSES[0]
    rng = createRng(warehouse.seed)
    truckSeq = 1040 + rng.int(0, 200)
    siteName = warehouse.name

    const slots: (PalletMeta | null)[] = []
    for (let i = 0; i < SLOT_COUNT; i++) {
      const { level } = slotPosition(i)
      // lower levels fill first, like a real pick-face strategy
      const p = Math.min(1, warehouse.fillRatio * (1.15 - level * 0.12))
      const daysAgo = rng.int(0, 40)
      slots.push(rng.chance(p) ? randomPallet(rng, new Date(SIM_START.getTime() - daysAgo * 864e5)) : null)
    }

    const forklifts: ForkliftSeed[] = [0, 1, 2, 3].map((i) => ({
      id: `FL-0${i + 1}`,
      model: FORKLIFT_MODELS[i % FORKLIFT_MODELS.length],
      operator: OPERATORS[i],
      battery: rng.int(58, 97),
    }))

    // Each site opens the shift in a different situation.
    const docked = (type: TruckType, qty: number, bay: number, done: number): TruckSeed => ({ ...randomTruck(rng, 0, type), qty, startDocked: { bay, done } })
    const trucks: TruckSeed[] =
      warehouse.id === 'harbor'
        ? [docked('inbound', 9, 1, 2), randomTruck(rng, 2, 'inbound'), randomTruck(rng, 7, 'inbound'), randomTruck(rng, 12)]
        : warehouse.id === 'northgate'
          ? [docked('outbound', 9, 0, 6), docked('outbound', 6, 1, 1), docked('inbound', 5, 2, 3), randomTruck(rng, 1, 'outbound'), randomTruck(rng, 9)]
          : [docked('outbound', 8, 0, 3), docked('inbound', 6, 2, 1), randomTruck(rng, 3), randomTruck(rng, 14)]

    return { warehouse, slots, forklifts, trucks }
  },

  poll(ctx) {
    const events: DataEvent[] = []
    // Keep a steady flow: up to 3 trucks announced on the highway, fewer when the yard is busy.
    const pressure = ctx.scheduledTrucks + ctx.trucksOnSite * 0.5
    if (ctx.scheduledTrucks < 3 && pressure < 5 && rng.chance(0.14)) {
      events.push({ type: 'truck_scheduled', truck: randomTruck(rng, rng.int(8, 24), undefined, ctx.fill) })
    }
    return events
  },

  createPallet({ time, responsible, lot }) {
    return randomPallet(rng, simDate(time), responsible, lot)
  },
}
