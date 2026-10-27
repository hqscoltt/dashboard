// Static site layout (world units ≈ meters). Scene and simulation both read from here,
// so moving a bay or rack row only needs a change in this file.
import type { Vec2 } from './types'

export const WAREHOUSE = { minX: -24, maxX: 24, minZ: -24, maxZ: -2, height: 8 }

export const BAY_X = [-10, 0, 10]
export const BAY_NAMES = ['Bay 1', 'Bay 2', 'Bay 3']
export const DOOR_HALF_WIDTH = 1.7
export const DOOR_HEIGHT = 4

// Truck geometry: origin at truck center, cab facing local +Z.
export const TRUCK_LENGTH = 10.2
export const TRUCK_WIDTH = 2.6
/** Truck center Z when backed into a bay (trailer rear touching the dock bumper). */
export const DOCK_TRUCK_Z = WAREHOUSE.maxZ + 0.35 + TRUCK_LENGTH / 2

export const ROAD = { z: 28, halfWidth: 3.6, minX: -70, maxX: 70 }
export const LANE_IN_Z = 29.6 // eastbound (+x), arriving trucks
export const LANE_OUT_Z = 26.4 // westbound (-x), departing trucks
export const YARD = { minX: -28, maxX: 42, minZ: WAREHOUSE.maxZ, maxZ: ROAD.z - ROAD.halfWidth }
export const STAGE_Z = 22.3

export const PARKING: Vec2[] = [
  { x: 28.5, z: 10 },
  { x: 32.5, z: 10 },
  { x: 36.5, z: 10 },
]

// Racks: 3 rows (A, B, C) × 16 bays × 3 levels = 144 pallet slots.
export const RACK_ROWS = [
  { name: 'A', z: -21.5 },
  { name: 'B', z: -15 },
  { name: 'C', z: -8.5 },
]
export const RACK_BAY_WIDTH = 2
export const RACK_BAY_XS = [
  -17, -15, -13, -11, -9, -7, -5, -3, 3, 5, 7, 9, 11, 13, 15, 17,
]
export const RACK_LEVELS = [0.12, 1.62, 3.12]
export const RACK_DEPTH = 1.3
export const RACK_HEIGHT = 4.4
/** Forklifts stop this far in front (+z) of a rack row center to pick/drop. */
export const RACK_ACCESS = 1.5

export const SLOT_COUNT = RACK_ROWS.length * RACK_BAY_XS.length * RACK_LEVELS.length

export function slotPosition(index: number) {
  const perRow = RACK_BAY_XS.length * RACK_LEVELS.length
  const row = Math.floor(index / perRow)
  const rem = index % perRow
  const bay = Math.floor(rem / RACK_LEVELS.length)
  const level = rem % RACK_LEVELS.length
  return {
    row,
    bay,
    level,
    x: RACK_BAY_XS[bay],
    y: RACK_LEVELS[level],
    z: RACK_ROWS[row].z,
    label: `${RACK_ROWS[row].name}-${String(bay + 1).padStart(2, '0')}-${level + 1}`,
  }
}

export const FORKLIFT_HOMES: Vec2[] = [
  { x: 21.6, z: -4 },
  { x: 21.6, z: -6.6 },
  { x: 21.6, z: -12.2 },
  { x: 21.6, z: -18.6 },
]

/** Point just inside the dock door where a forklift hands pallets to / from the trailer. */
export function trailerPoint(bay: number, lane: number): Vec2 {
  return { x: BAY_X[bay] + (lane === 0 ? -0.7 : 0.7), z: WAREHOUSE.maxZ - 1.55 }
}

export const OFFICE = { x: -38, z: 6, w: 12, d: 10, h: 7.5 }
