// Trucks and forklifts of the universal dashboard.
//
// When a record changes stage, it is queued as a transfer A -> B. A dispatcher groups
// transfers into truck loads: the truck drives to A's dock (backing in), a forklift brings
// pallets to the door, the truck drives along the street to B, backs into B's dock and
// unloads while B's forklift stores the pallets on the racks. New records arrive from the
// road; stock changes bring delivery / pickup trucks to the stock warehouses.
import { advance, type Mover, type Waypoint } from '../simulation/paths'
import { FRONT_LANE, LEVELS, SIDE, aisleTravelZ, aisleZ, doorOf, palletSlot, type BLayout, type Layout } from './layout'

// ------------------------------------------------------------------ wiring (set by the store)

interface FleetHost {
  layout: () => Layout
  contents: (buildingId: string) => string[]
  colorOf: (key: string) => string
  onPickup: (keys: string[]) => void
  onDeliver: (keys: string[]) => void
  clock: () => { paused: boolean; speed: number }
}
let host: FleetHost | null = null
export function configureFleet(h: FleetHost) {
  host = h
}

// ------------------------------------------------------------------ data

export interface Transfer {
  key: string
  from: string | null
  to: string | null
  road: string
  /** sim time when queued (set by enqueue) */
  at?: number
}

type TruckPhase = 'toA' | 'waitA' | 'dockA' | 'loadA' | 'toB' | 'waitB' | 'dockB' | 'unloadB' | 'exit'

export interface UTruck extends Mover {
  id: number
  variant: number
  road: string
  from: string | null
  to: string | null
  keys: string[]
  stockTrips: number
  phase: TruckPhase
  timer: number
  wait: number
  delivered: boolean
  picked: boolean
  backoff: number
  /** dock the truck is backing into / standing at, and where that door was last frame */
  anchor?: { id: string; x: number; z: number }
  /** street center line last frame (streets move when warehouses grow deeper) */
  roadZ?: number
}

interface ForkStep {
  x: number
  z: number
  forkY?: number
  carry?: boolean
  color?: string
  /** drive this stretch backwards (backing out of a bay) */
  reverse?: boolean
  /** a bay off the one-way loop (dock door, parking spot, pallet position) */
  bay?: boolean
  /** heading to the dock door: take the door lock first */
  doorEntry?: boolean
  /** reaching this step (just backed out of the door) completes the handover: the truck may leave */
  door?: boolean
  /** last step of a trip */
  end?: boolean
}

export interface UFork extends Mover {
  forkY: number
  forkTarget: number
  carrying: string | null
  steps: ForkStep[]
  pause: number
  pendingTrips: number
  /** door handovers still to happen for the truck at the dock */
  doorPending: number
  /** index of its parking spot (also its priority tie-break) */
  home: number
  wait: number
  /** step currently being driven to */
  current?: ForkStep
}

const TRUCK_SPEED = 10
const MAX_TRUCKS = 18
const MAX_PER_ROAD = 7
const MAX_LOAD = 40
const DOCK_TIME = 2
const LANE = 1.5 // lane offset from the road center line

export const fleet = {
  trucks: [] as UTruck[],
  forks: new Map<string, UFork[]>(), // forklifts of each warehouse section
  doorLocks: new Map<string, UFork>(), // one forklift at a time between the front lane and the dock door
  queue: [] as Transfer[],
  docks: new Map<string, number>(), // building id -> truck id
  version: 0, // bumps when the set of trucks changes
  listeners: new Set<() => void>(),
}
let seq = 1
let simTime = 0
const MAX_WAIT = 25 // queued longer than this (sim seconds) → moved without a truck
const MAX_QUEUE = 120 // beyond this, the oldest queued records move without a truck

function notify() {
  fleet.version++
  fleet.listeners.forEach((l) => l())
}

export function resetFleet() {
  fleet.trucks = []
  fleet.forks.clear()
  fleet.doorLocks.clear()
  fleet.queue = []
  fleet.docks.clear()
  notify()
}

export function enqueue(t: Transfer) {
  const queued = fleet.queue.find((q) => q.key === t.key)
  if (queued) queued.to = t.to // changed again before being picked up
  else fleet.queue.push({ ...t, at: simTime })
}

/** Delivery or pickup truck for a stock warehouse (no records, just pallets moving). */
export function enqueueStock(buildingId: string, inbound: boolean, trips: number) {
  if (fleet.docks.has(buildingId) || fleet.trucks.some((t) => (t.to === buildingId || t.from === buildingId) && t.stockTrips)) return
  spawn(inbound ? null : buildingId, inbound ? buildingId : null, 'avenue', [], Math.max(1, trips))
}

// ------------------------------------------------------------------ routes

function road(id: string) {
  return host!.layout().roads.find((r) => r.id === id)
}

function dockZ(b: BLayout) {
  return b.z + 5.6 // truck center when its rear touches the dock
}

/** Back into a dock, arriving eastbound (fromWest) or westbound. */
function approach(b: BLayout, fromWest: boolean): Waypoint[] {
  const d = doorOf(b)
  const r = b.roadZ
  const s = fromWest ? 1 : -1
  const lane = fromWest ? r + LANE : r - LANE
  // swing out, then a straight reverse of ~4 m so the truck ends square to the door
  return [
    { x: d.x + 9 * s, z: lane },
    { x: d.x + 5.2 * s, z: b.z + 12.6, reverse: true },
    { x: d.x + 1.6 * s, z: b.z + 10.6, reverse: true },
    { x: d.x, z: b.z + 9.4, reverse: true },
    { x: d.x, z: dockZ(b), reverse: true },
  ]
}

function pullOut(b: BLayout, east: boolean): Waypoint[] {
  const d = doorOf(b)
  const s = east ? 1 : -1
  return [
    { x: d.x, z: b.z + 10.5 },
    { x: d.x + 5 * s, z: b.roadZ + (east ? LANE : -LANE) },
  ]
}

function waitPoint(b: BLayout, fromWest: boolean): Waypoint {
  const d = doorOf(b)
  return fromWest ? { x: d.x - 8, z: b.roadZ + LANE } : { x: d.x + 15, z: b.roadZ - LANE }
}

function spawn(from: string | null, to: string | null, roadId: string, keys: string[], stockTrips = 0) {
  const rd = road(roadId)
  if (!rd) return
  const t: UTruck = {
    id: seq++, variant: seq % 4, road: roadId, from, to, keys, stockTrips,
    x: rd.x0, z: rd.z + LANE, heading: Math.PI / 2, targetHeading: Math.PI / 2, odometer: 0, path: [],
    phase: from ? 'toA' : 'toB', timer: 0, wait: 0, delivered: false, picked: false, backoff: 0,
  }
  const firstStop = from ?? to ?? ''
  const target = host!.layout().buildings[firstStop]
  if (!target) return
  // both docks of the trip are booked up front: nobody ever waits for a dock on the street
  fleet.docks.set(firstStop, t.id)
  if (from && to) fleet.docks.set(to, t.id)
  t.path = [waitPoint(target, true)]
  fleet.trucks.push(t)
  notify()
}

// ------------------------------------------------------------------ forklifts
//
// One-way circulation inside each section (as in real warehouses), so two forklifts never
// meet head-on:
//   front lane → east, right side aisle → towards the back, rack-row aisles → west,
//   left side aisle → back to the front.
// The dock door, the parking spots and the pallet positions are bays off that loop: a
// forklift drives in forwards and backs out. Waiting only ever means "wait for the one
// ahead", and the dock door is taken one forklift at a time (the next one waits upstream).

/** Bigger sections get more forklifts (1 to 3). */
export function forkCount(b: Pick<BLayout, 'bays' | 'rows'>) {
  const cap = b.bays * b.rows * LEVELS
  return 1 + (cap >= 45 ? 1 : 0) + (cap >= 120 ? 1 : 0)
}

/** Parking spots in the front staging area, away from the dock door. */
export function forkHomes(b: Pick<BLayout, 'w' | 'bays' | 'rows'>) {
  const door = b.w / 2
  const spots: { x: number; z: number }[] = []
  for (let k = 0; k < 6 && spots.length < 3; k++) {
    for (const x of [b.w - 4 - k * 2.6, 4 + k * 2.6]) {
      if (Math.abs(x - door) > 3.4 && !spots.some((s) => Math.abs(s.x - x) < 2.4)) spots.push({ x, z: -1.9 })
    }
  }
  return spots.slice(0, forkCount(b))
}

function forksOf(id: string, b: BLayout): UFork[] {
  const homes = forkHomes(b)
  let list = fleet.forks.get(id)
  if (!list) {
    list = []
    fleet.forks.set(id, list)
  }
  while (list.length < homes.length) {
    const h = homes[list.length]
    list.push({ x: h.x, z: h.z, heading: 0, targetHeading: 0, odometer: 0, path: [], forkY: 0.12, forkTarget: 0.12, carrying: null, steps: [], pause: 0, pendingTrips: 0, doorPending: 0, home: list.length, wait: 0 })
  }
  return list
}

/** The one-way loop of a section. */
function loopOf(b: BLayout) {
  const xL = SIDE / 2
  const xR = b.w - SIDE / 2
  const lane = FRONT_LANE
  return { xL, xR, lane, door: b.w / 2 }
}

/** From a point on the front lane, drive the loop (east, back, west, front) to come back to `x` heading east. */
function aroundTo(b: BLayout, fromX: number, x: number): ForkStep[] {
  const { xL, xR, lane } = loopOf(b)
  if (x > fromX + 0.05) return [{ x, z: lane }]
  const t0 = aisleTravelZ(0)
  return [{ x: xR, z: lane }, { x: xR, z: t0 }, { x: xL, z: t0 }, { x: xL, z: lane }, { x, z: lane }]
}

/** From the front lane at `fromX`: into row aisle `row`, west to the pallet, pick/drop, then back to the lane at the left. */
function viaRow(b: BLayout, fromX: number, row: number, slot: { x: number; y: number }, carry: boolean, color: string, liftAfter: number): ForkStep[] {
  const { xL, xR, lane } = loopOf(b)
  const t = aisleTravelZ(row)
  const steps: ForkStep[] = []
  if (fromX < xR - 0.05) steps.push({ x: xR, z: lane })
  steps.push({ x: xR, z: t }, { x: slot.x, z: t })
  steps.push({ x: slot.x, z: aisleZ(row), forkY: slot.y, carry, color, bay: true }) // into the pallet bay
  steps.push({ x: slot.x, z: t, forkY: liftAfter, reverse: true }) // back out
  steps.push({ x: xL, z: t }, { x: xL, z: lane })
  return steps
}

/** One forklift trip between the dock door and a rack slot, on the one-way loop. */
function forkTrip(id: string, b: BLayout, slotIndex: number, inbound: boolean, color: string) {
  const list = forksOf(id, b)
  const f = [...list].sort((a, c) => a.pendingTrips - c.pendingTrips || a.steps.length - c.steps.length)[0]
  if (!f || f.pendingTrips >= 2) return
  f.pendingTrips++
  f.doorPending++
  const home = forkHomes(b)[f.home] ?? { x: b.w - 4, z: -1.9 }
  const cap = Math.max(1, b.bays * b.rows * LEVELS)
  const s = palletSlot(Math.max(0, slotIndex) % cap, Math.max(1, b.bays))
  const { xL, lane, door } = loopOf(b)
  const doorBay: ForkStep[] = [
    { x: door, z: -1.7, forkY: 1.05, carry: inbound, color, bay: true },
    { x: door, z: lane, forkY: inbound ? 0.32 : 0.12, reverse: true, door: true },
  ]
  const steps: ForkStep[] = [{ x: home.x, z: lane, reverse: true }] // back out of the parking spot
  const toDoor = (fromX: number) => {
    const s2 = aroundTo(b, fromX, door)
    s2[s2.length - 1] = { ...s2[s2.length - 1], doorEntry: true }
    return s2
  }
  if (inbound) {
    steps.push(...toDoor(home.x), ...doorBay)
    steps.push(...viaRow(b, door, s.row, s, false, color, 0.12))
  } else {
    steps.push(...viaRow(b, home.x, s.row, s, true, color, 0.32))
    steps.push(...toDoor(xL), ...doorBay)
  }
  // back to the parking spot: continue east, or loop around if it is behind us
  const lastX = inbound ? xL : door
  steps.push(...aroundTo(b, lastX, home.x))
  steps.push({ x: home.x, z: home.z, bay: true, end: true })
  f.steps.push(...steps)
}

function isOnLoop(b: BLayout, f: UFork) {
  const { xL, xR, lane } = loopOf(b)
  if (Math.abs(f.z - lane) < 0.5) return true
  if (Math.abs(f.x - xL) < 0.5 || Math.abs(f.x - xR) < 0.5) return true
  for (let r = 0; r < b.rows; r++) if (Math.abs(f.z - aisleTravelZ(r)) < 0.5) return true
  return false
}

/** Point `dist` meters ahead along the forklift's remaining route. */
function forkClaim(f: UFork, dist = 1.9) {
  let x = f.x
  let z = f.z
  let left = dist
  const pts = [...f.path, ...f.steps]
  for (const wp of pts) {
    const d = Math.hypot(wp.x - x, wp.z - z)
    if (d >= left) return { x: x + ((wp.x - x) / d) * left, z: z + ((wp.z - z) / d) * left }
    left -= d
    x = wp.x
    z = wp.z
  }
  return null
}

/** 0 = hold position (somebody is ahead, or it's not our turn to back out onto the loop). */
function forkTraffic(f: UFork, list: UFork[], dt: number, b: BLayout | undefined) {
  const target = f.path[0]
  if (!target || !b) return 1
  const exiting = !!f.current?.reverse && !isOnLoop(b, f) // backing out of a bay onto the loop
  for (const g of list) {
    if (g === f) continue
    if (exiting) {
      // give way to traffic on the loop near the exit point
      if (g.wait === 0 && isOnLoop(b, g) && Math.hypot(g.x - target.x, g.z - target.z) < 2.6) return hold(f, dt)
      continue
    }
    const c = forkClaim(f)
    if (!c) continue
    if (Math.hypot(g.x - c.x, g.z - c.z) < 1.5 && (g.x - f.x) * (c.x - f.x) + (g.z - f.z) * (c.z - f.z) > 0) return hold(f, dt)
  }
  f.wait = 0
  return 1
}

function hold(f: UFork, dt: number) {
  f.wait += dt
  // safety valve: never freeze the scene, even in an unforeseen jam
  return f.wait > 5 ? 1 : 0
}

function updateFork(f: UFork, list: UFork[], dt: number, id: string, b: BLayout | undefined) {
  const d = f.forkTarget - f.forkY
  f.forkY += Math.sign(d) * Math.min(Math.abs(d), dt * 1.8)
  if (f.pause > 0) {
    f.pause -= dt
    advance(f, 0, 0, 6)
    return
  }
  if (!f.path.length && f.steps.length) {
    const st = f.steps[0]
    if (Math.hypot(st.x - f.x, st.z - f.z) < 0.05) {
      f.steps.shift()
      if (st.forkY !== undefined) { f.forkTarget = st.forkY; f.pause = 0.35 }
      if (st.carry === true) f.carrying = st.color ?? '#d6b48a'
      if (st.carry === false) f.carrying = null
      if (st.door) {
        f.doorPending = Math.max(0, f.doorPending - 1)
        if (fleet.doorLocks.get(id) === f) fleet.doorLocks.delete(id)
      }
      if (st.end) f.pendingTrips = Math.max(0, f.pendingTrips - 1)
    } else {
      // the dock door takes one forklift at a time: the next one waits upstream on the lane
      if (st.doorEntry) {
        const holder = fleet.doorLocks.get(id)
        if (holder && holder !== f) {
          hold(f, dt)
          advance(f, 0, 0, 6)
          return
        }
        fleet.doorLocks.set(id, f)
      }
      f.current = st
      f.path = [{ x: st.x, z: st.z, reverse: st.reverse }]
    }
  }
  advance(f, dt * forkTraffic(f, list, dt, b), 3.6, 7)
}

// ------------------------------------------------------------------ trucks

type Pose = { x: number; z: number; h: number }
const HALF = 5.1

function segDist(a: Pose, b: Pose) {
  let m = Infinity
  const sa = Math.sin(a.h), ca = Math.cos(a.h), sb = Math.sin(b.h), cb = Math.cos(b.h)
  for (let i = -HALF; i <= HALF; i += HALF / 3)
    for (let j = -HALF; j <= HALF; j += HALF / 3) m = Math.min(m, Math.hypot(a.x + sa * i - b.x - sb * j, a.z + ca * i - b.z - cb * j))
  return m
}

function nextPose(t: UTruck, k: number): Pose | null {
  const wp = t.path[0]
  if (!wp) return null
  const dx = wp.x - t.x
  const dz = wp.z - t.z
  const d = Math.hypot(dx, dz)
  if (d < 1e-3) return null
  return { x: t.x + (dx / d) * k, z: t.z + (dz / d) * k, h: t.heading }
}

function blocks(t: UTruck, o: UTruck) {
  const n = nextPose(t, 2.2)
  if (!n) return false
  const op = { x: o.x, z: o.z, h: o.heading }
  const dn = segDist(n, op)
  // too close and closing in — or sliding past with less than a truck width between bodies
  return dn < 2.7 && (dn < segDist({ x: t.x, z: t.z, h: t.heading }, op) + 1e-3 || dn < 2.55)
}

const MANEUVER = new Set<UTruck['phase']>(['dockA', 'dockB'])

function priority(t: UTruck) {
  return (MANEUVER.has(t.phase) ? 1000 : 0) - t.id
}

/** Reverse a few meters along the way it came, to unlock a head-to-head situation. */
function backOff(t: UTruck) {
  const n = nextPose(t, 1)
  if (!n) return
  const dx = n.x - t.x
  const dz = n.z - t.z
  t.path.unshift({ x: t.x - dx * 4.5, z: t.z - dz * 4.5, reverse: !t.path[0]?.reverse })
  t.backoff = 6
}

const ZONE = 15 // half-length of the street stretch closed while a truck maneuvers at a dock

/** Street x of a maneuver in progress (backing into a dock, or pulling out of it), if any. */
function maneuverAt(t: UTruck): number | null {
  if (MANEUVER.has(t.phase)) {
    const b = host!.layout().buildings[t.phase === 'dockA' ? t.from ?? '' : t.to ?? '']
    return b ? doorOf(b).x : null
  }
  const rd = road(t.road)
  if ((t.phase === 'exit' || t.phase === 'toB') && rd && t.z < rd.z - 1.2) return t.x // still on the apron
  return null
}

/** Others wait before a stretch of street where a truck is maneuvering (like a real yard). */
function zoneClosed(t: UTruck): UTruck | null {
  const n = nextPose(t, 2.5)
  if (!n) return null
  const mine = maneuverAt(t)
  for (const o of fleet.trucks) {
    if (o === t || o.road !== t.road) continue
    const x = maneuverAt(o)
    if (x === null) continue
    // two maneuvers at neighbouring docks never overlap: the later one waits for the earlier
    if (mine !== null) {
      if (o.id < t.id && Math.abs(mine - x) < ZONE) return o
      continue
    }
    const inside = Math.abs(t.x - x) < ZONE
    const entering = Math.abs(n.x - x) < ZONE
    const approaching = Math.abs(n.x - x) < Math.abs(t.x - x)
    if ((!inside && entering) || (inside && approaching)) return o
  }
  return null
}

function trafficFactor(t: UTruck, dt: number) {
  t.backoff = Math.max(0, t.backoff - dt)
  const maneuvering = zoneClosed(t)
  if (maneuvering) {
    t.wait += dt
    // standing in the way of the maneuver: make room
    if (blocks(maneuvering, t) && t.wait > 1 && t.backoff === 0) { backOff(t); t.wait = 0; return 1 }
    return 0
  }
  for (const o of fleet.trucks) {
    if (o === t || o.road !== t.road || !blocks(t, o)) continue
    const mutual = blocks(o, t)
    const iWin = priority(t) > priority(o)
    const next = nextPose(t, 2.2)
    // right of way only counts if my next move really keeps clear of the other truck
    if (mutual && iWin && next && segDist(next, { x: o.x, z: o.z, h: o.heading }) >= 2.7) continue
    t.wait += dt
    if (mutual && !iWin && t.wait > 2.5 && t.backoff === 0 && !MANEUVER.has(t.phase)) { backOff(t); t.wait = 0 }
    return t.wait > 40 ? 1 : 0 // last resort only
  }
  t.wait = 0
  return 1
}

function dockFree(id: string, t: UTruck) {
  const holder = fleet.docks.get(id)
  return holder === undefined || holder === t.id
}

/** True while the warehouse forklift still has to hand pallets over at the dock door. */
function forkBusyAtDoor(buildingId: string) {
  return (fleet.forks.get(buildingId) ?? []).some((f) => f.doorPending > 0)
}

function leave(t: UTruck, b: BLayout) {
  const rd = road(t.road)!
  t.path = [...pullOut(b, true), { x: rd.x1, z: rd.z + LANE }]
  t.phase = 'exit'
}

/** Shift a truck and the rest of its route (e.g. when the warehouse it is docked at grows). */
function shiftTruck(t: UTruck, dx: number, dz: number) {
  if (!dx && !dz) return
  t.x += dx
  t.z += dz
  for (const p of t.path) {
    p.x += dx
    p.z += dz
  }
}

/** Keep trucks glued to their dock and their street when the layout changes under them. */
function followLayout(t: UTruck, L: Layout) {
  const dockId = t.phase === 'dockA' || t.phase === 'loadA' ? t.from : t.phase === 'dockB' || t.phase === 'unloadB' ? t.to : null
  const b = dockId ? L.buildings[dockId] : null
  if (dockId && b) {
    const door = doorOf(b)
    if (t.anchor?.id === dockId) shiftTruck(t, door.x - t.anchor.x, door.z - t.anchor.z)
    t.anchor = { id: dockId, x: door.x, z: door.z }
    t.roadZ = b.roadZ
    return
  }
  t.anchor = undefined
  const rd = L.roads.find((r) => r.id === t.road)
  if (!rd) return
  if (t.roadZ !== undefined && t.roadZ !== rd.z) shiftTruck(t, 0, rd.z - t.roadZ)
  t.roadZ = rd.z
}

function updateTruck(t: UTruck, dt: number) {
  const L = host!.layout()
  followLayout(t, L)
  const A = t.from ? L.buildings[t.from] : null
  const B = t.to ? L.buildings[t.to] : null
  const k = trafficFactor(t, dt)
  const done = advance(t, dt * k, TRUCK_SPEED, 3)

  switch (t.phase) {
    case 'toA':
    case 'toB': {
      if (!done) break
      t.phase = t.phase === 'toA' ? 'waitA' : 'waitB'
      break
    }
    case 'waitA':
    case 'waitB': {
      const target = t.phase === 'waitA' ? A : B
      const id = t.phase === 'waitA' ? t.from! : t.to!
      if (!target) { t.phase = 'exit'; t.path = [{ x: road(t.road)!.x1, z: road(t.road)!.z + LANE }]; break }
      if (!dockFree(id, t)) break
      fleet.docks.set(id, t.id)
      const fromWest = t.x < doorOf(target).x
      t.path = approach(target, fromWest)
      t.phase = t.phase === 'waitA' ? 'dockA' : 'dockB'
      break
    }
    case 'dockA':
      if (done && A) {
        t.targetHeading = 0 // cab facing the street, rear square to the door
        t.phase = 'loadA'
        t.timer = DOCK_TIME
        const contents = host!.contents(A.id)
        const trips = t.keys.length ? t.keys : Array.from({ length: t.stockTrips }, () => '')
        trips.slice(0, 2).forEach((key) => forkTrip(A.id, A, key ? contents.indexOf(key) : Math.floor(Math.random() * Math.max(1, contents.length || 30)), false, key ? host!.colorOf(key) : '#c8a27a'))
      }
      break
    case 'loadA':
      t.timer -= dt
      if (t.timer <= 0 && A && !forkBusyAtDoor(A.id)) {
        if (t.keys.length && !t.picked) host!.onPickup(t.keys)
        t.picked = true
        fleet.docks.delete(A.id)
        if (B) {
          const east = doorOf(B).x > doorOf(A).x
          t.path = [...pullOut(A, east), waitPoint(B, east)]
          t.phase = 'toB'
        } else leave(t, A)
      }
      break
    case 'dockB':
      if (done && B) {
        t.targetHeading = 0
        t.phase = 'unloadB'
        t.timer = DOCK_TIME
      }
      break
    case 'unloadB':
      t.timer -= dt
      if (B && !t.delivered && t.timer < DOCK_TIME * 0.45) {
        t.delivered = true
        if (t.keys.length) host!.onDeliver(t.keys)
        const contents = host!.contents(B.id)
        const trips = t.keys.length ? t.keys : Array.from({ length: t.stockTrips }, () => '')
        trips.slice(0, 2).forEach((key) => forkTrip(B.id, B, key ? contents.indexOf(key) : Math.floor(Math.random() * Math.max(1, contents.length || 30)), true, key ? host!.colorOf(key) : '#c8a27a'))
      }
      if (t.timer <= 0 && B && t.delivered && !forkBusyAtDoor(B.id)) {
        fleet.docks.delete(B.id)
        leave(t, B)
      }
      break
    case 'exit':
      if (done) t.timer = -1 // removed by the caller
      break
  }
}

function dispatch() {
  // relief valve: when trucks can't keep up, long-waiting records move directly
  const overflow = Math.max(0, fleet.queue.length - MAX_QUEUE)
  const stale = fleet.queue.filter((q, i) => i < overflow || simTime - (q.at ?? simTime) > MAX_WAIT)
  if (stale.length) {
    fleet.queue = fleet.queue.filter((q) => !stale.includes(q))
    host!.onDeliver(stale.map((q) => q.key))
  }
  if (!fleet.queue.length || fleet.trucks.length >= MAX_TRUCKS) return
  // group by trip, biggest first
  const groups = new Map<string, Transfer[]>()
  for (const q of fleet.queue) {
    const k = `${q.road}|${q.from}|${q.to}`
    if (!groups.has(k)) groups.set(k, [])
    groups.get(k)!.push(q)
  }
  const sorted = [...groups.values()].sort((a, b) => b.length - a.length)
  for (const g of sorted) {
    if (fleet.trucks.length >= MAX_TRUCKS) break
    const rd = road(g[0].road)
    if (!rd || fleet.trucks.filter((t) => t.road === rd.id).length >= MAX_PER_ROAD) continue
    // the road entrance must be clear
    if (fleet.trucks.some((t) => t.road === rd.id && Math.hypot(t.x - rd.x0, t.z - rd.z) < 13)) continue
    // every dock of the trip must be free (booked by nobody)
    if ((g[0].from && fleet.docks.has(g[0].from)) || (g[0].to && fleet.docks.has(g[0].to))) continue
    const load = g.slice(0, MAX_LOAD)
    fleet.queue = fleet.queue.filter((q) => !load.includes(q))
    if (!g[0].from && !g[0].to) continue
    spawn(g[0].from, g[0].to, g[0].road, load.map((q) => q.key))
  }
}

let dispatchAcc = 0

/** Advance trucks, forklifts and the dispatcher. Call once per frame. */
export function updateFleet(realDt: number) {
  if (!host) return
  const { paused, speed } = host.clock()
  if (paused) return
  const dt = Math.min(realDt, 0.1) * speed
  simTime += dt
  dispatchAcc += dt
  if (dispatchAcc > 0.5) {
    dispatchAcc = 0
    dispatch()
  }
  for (const t of fleet.trucks) updateTruck(t, dt)
  const before = fleet.trucks.length
  fleet.trucks = fleet.trucks.filter((t) => !(t.phase === 'exit' && t.timer === -1))
  if (fleet.trucks.length !== before) notify()
  const L = host.layout()
  fleet.forks.forEach((list, id) => list.forEach((f) => updateFork(f, list, dt, id, L.buildings[id])))
}

/** 0..1 how open a warehouse's dock door should be. */
export function doorWanted(buildingId: string) {
  const id = fleet.docks.get(buildingId)
  if (id === undefined) return 0
  const t = fleet.trucks.find((x) => x.id === id)
  return t && (t.phase === 'loadA' || t.phase === 'unloadB' || t.phase === 'dockA' || t.phase === 'dockB') ? 1 : 0
}
