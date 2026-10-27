// Auto-generated site layout, in the same visual language as the logistics yard:
// row 0 = headquarters (office) + one open warehouse per stock; then one street per flow
// with ONE big warehouse per flow, split by internal walls into one section per stage
// (each section has its own dock door, racks and forklifts). Racks are laid out with real
// aisles (side aisles + a central cross aisle on wide sections) so forklifts never cut
// through shelves. Sizes follow the number of pallets: data growth = warehouses expanding.
import type { UModel } from './types'

export const MAX_VISIBLE = 360 // pallets drawn per warehouse (the sign shows the real count)
export const LEVELS = 3
export const BAY = 2 // rack bay width (one pallet per level)
export const ROW_PITCH = 4.6 // rack row + aisle
export const FRONT = 6 // depth of the front staging area (dock leveler, forklift parking)
export const SIDE = 3 // side aisle inside the walls (room for a forklift to pull over)
export const CROSS = 3.4 // central cross aisle width (sections with many bays)
const SPLIT_FROM = 7 // bays per row from which a central cross aisle is added
export const APRON = 15 // distance from the building front to its road center line
const GAP = 6

export type BuildingKind = 'hq' | 'stage' | 'stock'

export interface BLayout {
  id: string
  kind: BuildingKind
  x: number // front-left corner
  z: number // front wall line (buildings extend towards -z)
  w: number
  d: number
  h: number
  label: string
  color: string
  flowId?: string
  stage?: string
  stockId?: string
  /** rack bays per row */
  bays: number
  rows: number
  /** sections of one big warehouse: the wall to the left / right is an internal partition */
  joinL?: boolean
  joinR?: boolean
  /** z of the road serving this building's dock */
  roadZ: number
}

export interface RoadLayout {
  id: string // flow id, or 'avenue'
  z: number
  x0: number
  x1: number
  label: string
  color: string
}

export interface Layout {
  buildings: Record<string, BLayout>
  order: string[]
  roads: RoadLayout[]
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
}

/** Rack grid for `n` pallets: grows sideways first, then adds rows. */
export function rackGrid(n: number) {
  const m = Math.max(1, Math.min(n, MAX_VISIBLE))
  const perRowWanted = Math.ceil(Math.sqrt((m / LEVELS) * 2.2))
  const bays = Math.min(14, Math.max(4, perRowWanted))
  const rows = Math.max(1, Math.ceil(m / (bays * LEVELS)))
  return { bays, rows }
}

/** Rack runs of a section: one run, or two runs split by a central cross aisle. */
export function rackPlan(bays: number) {
  const split = bays >= SPLIT_FROM
  const left = split ? Math.ceil(bays / 2) : bays
  const width = bays * BAY + SIDE * 2 + (split ? CROSS : 0)
  const runs: { x0: number; bays: number }[] = split
    ? [{ x0: SIDE, bays: left }, { x0: SIDE + left * BAY + CROSS, bays: bays - left }]
    : [{ x0: SIDE, bays }]
  // vertical aisles a forklift can use to go from the front lane to any rack row
  const aisles = [SIDE / 2, width - SIDE / 2, ...(split ? [SIDE + left * BAY + CROSS / 2] : [])]
  const bayX = (b: number) => SIDE + b * BAY + BAY / 2 + (split && b >= left ? CROSS : 0)
  return { split, left, width, runs, aisles, bayX }
}

/** Every stage section has the same fixed size; the real count is shown on its sign/panel. */
export const SECTION_BAYS = 8
export const SECTION_ROWS = 3
export const SECTION_CAPACITY = SECTION_BAYS * SECTION_ROWS * LEVELS

export function warehouseSize() {
  return { w: rackPlan(SECTION_BAYS).width, d: FRONT + SECTION_ROWS * ROW_PITCH + 1.5, bays: SECTION_BAYS, rows: SECTION_ROWS }
}

/** Pallet positions a warehouse can show. */
export function capacityOf(b: Pick<BLayout, 'bays' | 'rows'>) {
  return b.bays * b.rows * LEVELS
}

/** Local position (from the front-left corner) of the i-th pallet. */
export function palletSlot(i: number, bays: number) {
  const perRow = bays * LEVELS
  const row = Math.floor(i / perRow)
  const j = i % perRow
  return {
    x: rackPlan(bays).bayX(Math.floor(j / LEVELS)),
    y: 0.14 + (j % LEVELS) * 1.5,
    z: rowZ(row),
    row,
  }
}

/** Center line of a rack row. */
export function rowZ(row: number) {
  return -(FRONT + row * ROW_PITCH + 1)
}

/** Where a forklift stands (facing the rack) to reach a pallet of this row. */
export function aisleZ(row: number) {
  return rowZ(row) + 1.7
}

/** Travel line in the aisle in front of a row (middle of the aisle). */
export function aisleTravelZ(row: number) {
  return rowZ(row) + 2.4
}

/** Front lane (staging area) where forklifts drive across the section. */
export const FRONT_LANE = -3.9

export function palletsPerGroup(model: UModel, stockId: string, units: number) {
  const s = model.stocks.find((x) => x.def.id === stockId)
  if (!s) return []
  return s.groups.map((g) => {
    const items = s.items.filter((i) => i.group === g)
    return { group: g, items: items.map((i) => ({ key: i.key, pallets: Math.ceil(i.qty / units), low: i.low, title: i.title })) }
  })
}

/** Stock warehouses: one rack row per group (rows wrap when a group is long). */
export function stockGrid(groups: { items: { pallets: number }[] }[]) {
  const bays = 10 // fixed: a full rack row means "this group has at least this much"
  const rows = Math.max(1, groups.length)
  return { bays, rows, w: rackPlan(bays).width, d: FRONT + rows * ROW_PITCH + 1.5 }
}

/**
 * Capacity with hysteresis, so warehouses don't pulse while records come and go:
 * grow (with headroom) as soon as they're needed, shrink only when mostly empty.
 * `caps` is persistent per site and mutated here.
 */
export function capacity(caps: Record<string, number>, id: string, n: number) {
  const cur = caps[id]
  const step = 12
  if (cur === undefined || n > cur) caps[id] = Math.ceil((n * 1.15) / step) * step || step
  else if (n < cur * 0.35) caps[id] = Math.max(step, Math.ceil((n * 1.4) / step) * step)
  return caps[id]
}

export function computeLayout(model: UModel, _counts: Record<string, number>, palletUnits: Record<string, number>, hqLabel: string, _caps: Record<string, number> = {}): Layout {
  const buildings: Record<string, BLayout> = {}
  const order: string[] = []
  const roads: RoadLayout[] = []
  let maxX = 0

  // row 0: headquarters office + stock warehouses, served by the avenue
  let x = 0
  let depth0 = 12
  const stocks = model.stocks.map((s) => ({ s, g: stockGrid(palletsPerGroup(model, s.def.id, palletUnits[s.def.id] ?? 1)) }))
  for (const { g } of stocks) depth0 = Math.max(depth0, g.d)
  const avenueZ = APRON
  buildings.hq = { id: 'hq', kind: 'hq', x, z: 0, w: 16, d: 12, h: 9, label: hqLabel, color: '#2563eb', bays: 0, rows: 0, roadZ: avenueZ }
  order.push('hq')
  x += 16 + GAP + 8 // room for the staff car park
  for (const { s, g } of stocks) {
    const id = `stock:${s.def.id}`
    buildings[id] = { id, kind: 'stock', x, z: 0, w: g.w, d: g.d, h: 7, label: s.def.label, color: '#0f766e', stockId: s.def.id, bays: g.bays, rows: g.rows, roadZ: avenueZ }
    order.push(id)
    x += g.w + GAP
  }
  maxX = Math.max(maxX, x)
  roads.push({ id: 'avenue', z: avenueZ, x0: -24, x1: 0, label: 'Estoque', color: '#0f766e' })

  // one street per flow
  let prevRoad = avenueZ
  for (const f of model.flows) {
    const sizes = f.stages.map(() => warehouseSize())
    // one building per flow: every section shares the same depth and sits wall to wall
    const depth = Math.max(...sizes.map((s) => s.d))
    const front = prevRoad + 6 + depth
    const roadZ = front + APRON
    let bx = 0
    f.stages.forEach((st, i) => {
      const id = `stage:${f.def.id}:${st.value}`
      const sz = sizes[i]
      // keep docks far enough apart for trucks to back in side by side
      const w = Math.max(sz.w, 15)
      buildings[id] = {
        id, kind: 'stage', x: bx, z: front, w, d: depth, h: 7, label: st.label, color: st.color, flowId: f.def.id, stage: st.value,
        bays: sz.bays, rows: sz.rows, roadZ, joinL: i > 0, joinR: i < f.stages.length - 1,
      }
      order.push(id)
      bx += w
    })
    bx += GAP
    maxX = Math.max(maxX, bx)
    roads.push({ id: f.def.id, z: roadZ, x0: -24, x1: 0, label: f.def.label, color: f.color })
    prevRoad = roadZ
  }
  roads.forEach((r) => (r.x1 = maxX + 22))

  return {
    buildings,
    order,
    roads,
    bounds: { minX: -26, maxX: maxX + 24, minZ: -depth0 - 10, maxZ: prevRoad + 10 },
  }
}

export function doorOf(b: { x: number; z: number; w: number }) {
  return { x: b.x + b.w / 2, z: b.z }
}
