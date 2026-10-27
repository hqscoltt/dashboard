// Traffic rules so vehicles never drive through each other.
//
// Forklifts: each moving forklift claims the floor just ahead of it. On a conflict the one with
// lower priority (not carrying a pallet) stops and re-plans with the other's spot blocked, so it
// passes alongside in the aisle or takes another aisle. Behind a working forklift: wait, then
// re-plan around it.
//
// Trucks: keep distance from any truck in front of their direction of travel (also when
// reversing). In a mutual conflict, the truck leaving the yard has right of way.
import { LANE_OUT_Z, TRUCK_LENGTH } from '../data/layout'
import type { Vec2 } from '../data/types'
import type { ForkliftSim, TruckSim } from './engine'
import { findPath } from './pathfinding'

// ---------------------------------------------------------------- forklifts

const CLAIM = 2.2 // a moving forklift claims the floor this far ahead of its center
const RADIUS = 1.4 // minimum distance between a claim and another forklift
const REPLAN_EVERY = 1 // seconds between re-plans of the same forklift
const WAIT_BEFORE_REPLAN = 0.8

const MOVING = new Set(['toPickup', 'toDrop', 'return'])

/** Kept as a function so the renderer has a single source for the drawn position. */
export function forkliftPos(f: ForkliftSim): Vec2 {
  return { x: f.x, z: f.z }
}

function claimOf(f: ForkliftSim): Vec2 | null {
  if (!MOVING.has(f.phase) || !f.path.length) return null
  // walk CLAIM units along the remaining path
  let x = f.x
  let z = f.z
  let left = CLAIM
  for (const wp of f.path) {
    const d = Math.hypot(wp.x - x, wp.z - z)
    if (d >= left) return { x: x + ((wp.x - x) / d) * left, z: z + ((wp.z - z) / d) * left }
    left -= d
    x = wp.x
    z = wp.z
  }
  return { x, z }
}

function priority(f: ForkliftSim) {
  return (f.cargo ? 10 : 0) - Number(f.v.id.replace(/\D/g, '')) * 0.01
}

function conflicts(f: ForkliftSim, g: ForkliftSim) {
  const c = claimOf(f)
  if (!c) return false
  const toG = Math.hypot(g.x - c.x, g.z - c.z) < RADIUS
  const gc = claimOf(g)
  const claims = gc ? Math.hypot(gc.x - c.x, gc.z - c.z) < RADIUS * 0.9 : false
  // only care about what is ahead, not something we are already leaving behind
  const ahead = (g.x - f.x) * (c.x - f.x) + (g.z - f.z) * (c.z - f.z) > 0
  // already close and the next move brings us closer (e.g. converging side by side)
  const now = Math.hypot(g.x - f.x, g.z - f.z)
  const step = Math.min(0.6, CLAIM) / CLAIM
  const closer = now < 1.7 && Math.hypot(g.x - (f.x + (c.x - f.x) * step), g.z - (f.z + (c.z - f.z) * step)) < now
  return (ahead && (toG || claims)) || closer
}

function replan(f: ForkliftSim, all: ForkliftSim[]) {
  const goal = f.path[f.path.length - 1]
  const others: Vec2[] = []
  for (const g of all) {
    if (g === f) continue
    others.push({ x: g.x, z: g.z })
    const gc = claimOf(g)
    if (gc) others.push(gc)
  }
  const alt = findPath({ x: f.x, z: f.z }, goal, others)
  if (alt.length) f.path = alt
  f.replanAt = 0
}

/**
 * Speed factor for this frame (0 = hold position). Lower-priority forklifts re-plan around
 * the other one: in wide aisles A* passes alongside it, otherwise it takes another aisle.
 */
export function forkliftTraffic(f: ForkliftSim, all: ForkliftSim[], dt: number): number {
  f.replanAt += dt
  if (!MOVING.has(f.phase) || !f.path.length) {
    f.wait = 0
    return 1
  }
  for (const g of all) {
    if (g === f || !conflicts(f, g)) continue
    const mutual = conflicts(g, f)
    if (mutual && priority(f) > priority(g)) continue // the other one gives way
    f.wait += dt
    const patience = mutual ? 0.15 : WAIT_BEFORE_REPLAN
    if (f.wait > patience && f.replanAt > REPLAN_EVERY) replan(f, all)
    return 0
  }
  f.wait = 0
  return 1
}

// ---------------------------------------------------------------- trucks

const HALF = TRUCK_LENGTH / 2
const TRUCK_CLEAR = 1.9 // half width + margin

function motionDir(t: TruckSim): Vec2 | null {
  const wp = t.path[0]
  if (!wp) return null
  const dx = wp.x - t.x
  const dz = wp.z - t.z
  const d = Math.hypot(dx, dz)
  return d > 1e-3 ? { x: dx / d, z: dz / d } : null
}

type Pose = { x: number; z: number; h: number }

function poseOf(t: TruckSim, ahead = 0): Pose {
  const dir = ahead ? motionDir(t) : null
  return dir ? { x: t.x + dir.x * ahead, z: t.z + dir.z * ahead, h: t.heading } : { x: t.x, z: t.z, h: t.heading }
}

function segDist(a: Pose, b: Pose) {
  // distance between two truck centerlines (sampled; trucks are short segments)
  let m = Infinity
  const sa = Math.sin(a.h), ca = Math.cos(a.h), sb = Math.sin(b.h), cb = Math.cos(b.h)
  for (let i = -HALF; i <= HALF; i += HALF / 4)
    for (let j = -HALF; j <= HALF; j += HALF / 4) m = Math.min(m, Math.hypot(a.x + sa * i - b.x - sb * j, a.z + ca * i - b.z - cb * j))
  return m
}

const BODY_GAP = TRUCK_CLEAR * 1.4 // ≈ truck width

/** Would t's body hit o (where o is now, or where o is about to be) if t kept moving? */
function blocks(t: TruckSim, o: TruckSim) {
  if (!motionDir(t)) return false
  const next = poseOf(t, 2.2)
  const theirs = [poseOf(o), poseOf(o, 3.5)]
  return theirs.some((p) => {
    const d = segDist(next, p)
    return d < BODY_GAP && d < segDist(poseOf(t), p) + 1e-3
  })
}

function truckPriority(t: TruckSim) {
  return (t.v.status === 'saindo' ? 100 : 0) - Number(t.v.id.replace(/\D/g, '')) * 0.001
}

/** Reverse a few meters along the way it came, to unlock a crossing. */
function backOff(t: TruckSim) {
  const dir = motionDir(t)
  if (!dir) return
  const reverse = !t.path[0]?.reverse
  t.path.unshift({ x: t.x - dir.x * 4.5, z: t.z - dir.z * 4.5, reverse })
  t.backoffCd = 6
  t.wait = 0
}

/** Arriving trucks give way to departing ones before crossing the outbound lane. */
function mustYieldAtCrossing(t: TruckSim, all: TruckSim[]) {
  if (t.v.status !== 'chegando' || !t.path.length) return false
  const next = t.path[0]
  const approaching = t.z > LANE_OUT_Z + 1.2 && next.z < LANE_OUT_Z + 1.2
  if (!approaching) return false
  return all.some((o) => o !== t && o.visible && o.v.status === 'saindo' && Math.abs(o.z - LANE_OUT_Z) < 2 && o.x > t.x - 6 && o.x < t.x + 26)
}

export function truckTraffic(t: TruckSim, all: TruckSim[], dt: number): number {
  t.backoffCd = Math.max(0, t.backoffCd - dt)
  if (mustYieldAtCrossing(t, all)) {
    t.wait += dt
    return 0
  }
  for (const o of all) {
    if (o === t || !o.visible || !blocks(t, o)) continue
    const mutual = blocks(o, t)
    const iWin = truckPriority(t) > truckPriority(o)
    // right of way only helps if my next move really clears the other truck
    if (mutual && iWin && segDist(poseOf(t, 2.2), poseOf(o)) >= BODY_GAP) continue
    t.wait += dt
    if (mutual && !iWin && t.wait > 2.5 && t.backoffCd === 0) backOff(t)
    return t.wait > 25 ? 1 : 0 // last-resort valve against a permanent jam
  }
  t.wait = 0
  return 1
}
