// Yard routes for trucks. Waypoints flagged `reverse` are driven backwards
// (the truck faces away from the direction of travel), which is how trucks back into bays.
import { BAY_X, DOCK_TRUCK_Z, LANE_IN_Z, LANE_OUT_Z, PARKING, STAGE_Z } from '../data/layout'

export type Waypoint = { x: number; z: number; reverse?: boolean }

export const SPAWN = { x: -68, z: LANE_IN_Z, heading: Math.PI / 2 }
export const EXIT_X = -72

function backIntoBay(bay: number, fromEast: boolean): Waypoint[] {
  const bx = BAY_X[bay]
  const s = fromEast ? -1 : 1
  return [
    { x: bx + 9 * s, z: STAGE_Z },
    { x: bx + 4.5 * s, z: 18.6, reverse: true },
    { x: bx + 0.8 * s, z: 14.2, reverse: true },
    { x: bx, z: 11, reverse: true },
    { x: bx, z: DOCK_TRUCK_Z, reverse: true },
  ]
}

export function roadToDock(bay: number): Waypoint[] {
  const bx = BAY_X[bay]
  return [{ x: bx + 2, z: LANE_IN_Z }, { x: bx + 6.5, z: 25 }, ...backIntoBay(bay, false)]
}

export function roadToParking(p: number): Waypoint[] {
  const { x, z } = PARKING[p]
  return [
    { x: x - 7, z: LANE_IN_Z },
    { x: x - 2, z: 26 },
    { x: x - 0.3, z: STAGE_Z },
    { x, z: z + 4 },
    { x, z },
  ]
}

export function parkingToDock(p: number, bay: number): Waypoint[] {
  const { x, z } = PARKING[p]
  return [
    { x, z: z + 5, reverse: true },
    { x: x + 2.5, z: z + 9.5, reverse: true },
    { x: x - 3.5, z: STAGE_Z + 0.6 },
    ...backIntoBay(bay, true),
  ]
}

export function dockToExit(bay: number): Waypoint[] {
  const bx = BAY_X[bay]
  return [
    { x: bx, z: 16 },
    { x: bx - 2.5, z: 22 },
    { x: bx - 8, z: LANE_OUT_Z },
    { x: EXIT_X, z: LANE_OUT_Z },
  ]
}

/** Shortest signed angle from a to b. */
export function angleDelta(a: number, b: number) {
  let d = (b - a) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

export interface Mover {
  x: number
  z: number
  heading: number
  targetHeading: number
  odometer: number
  path: Waypoint[]
}

/** Advances a mover along its path at `speed` (reverse legs at half speed). Returns true when the path is done. */
export function advance(m: Mover, dt: number, speed: number, turnRate = 4) {
  let budget = dt
  while (budget > 1e-6 && m.path.length) {
    const wp = m.path[0]
    const dx = wp.x - m.x
    const dz = wp.z - m.z
    const d = Math.hypot(dx, dz)
    if (d < 1e-3) {
      m.path.shift()
      continue
    }
    const dirHeading = Math.atan2(dx, dz)
    m.targetHeading = wp.reverse ? dirHeading + Math.PI : dirHeading
    // Don't drive until roughly facing the right way (prevents sliding sideways on sharp turns).
    const misalign = Math.abs(angleDelta(m.heading, m.targetHeading))
    const v = (wp.reverse ? speed * 0.55 : speed) * (misalign > 1.2 ? 0.25 : 1)
    const s = Math.min(d, v * budget)
    m.x += (dx / d) * s
    m.z += (dz / d) * s
    m.odometer += wp.reverse ? -s : s
    budget -= s / v
    if (s >= d - 1e-6) m.path.shift()
  }
  m.heading += angleDelta(m.heading, m.targetHeading) * (1 - Math.exp(-dt * turnRate))
  return m.path.length === 0
}
