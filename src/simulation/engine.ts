// Simulation engine.
// - Continuous part (vehicle motion, forks, doors) runs every frame via `update(dt)`.
// - Discrete part (`tick`, once per simulated second) handles arrivals, ETAs, deliveries,
//   polling the data source and KPI history.
// Kinematic state lives here as plain mutable objects (read by the 3D scene in useFrame);
// only compact view objects are pushed to the Zustand store.
import { mockDataSource, type LogisticsDataSource, type TruckSeed } from '../data/dataSource'
import {
  BAY_NAMES, BAY_X, DOCK_TRUCK_Z, FORKLIFT_HOMES, PARKING, RACK_ACCESS, RACK_LEVELS, RACK_ROWS,
  SLOT_COUNT, slotPosition, trailerPoint,
} from '../data/layout'
import { SIM_START, formatClock, formatDate } from '../data/mockData'
import type {
  ActivityEvent, DockView, ForkliftView, KpiHistory, Kpis, PalletMeta, Selection, TruckStatus,
  TruckView, Vec2,
} from '../data/types'
import { useSim } from '../store/useSimStore'
import { findPath } from './pathfinding'
import { forkliftTraffic, truckTraffic } from './traffic'
import {
  SPAWN, advance, angleDelta, dockToExit, parkingToDock, roadToDock, roadToParking,
  type Mover, type Waypoint,
} from './paths'

const TRUCK_SPEED = 7.5
const FORKLIFT_SPEED = 3.8
const FORK_SPEED = 1.5
const CARRY_Y = 0.32
const TRAILER_Y = 1.05
const HISTORY_LEN = 40

const Slot = { Empty: 0, Full: 1, ReservedPick: 2, ReservedDrop: 3 } as const

export const YARD_STATUSES: TruckStatus[] = ['chegando', 'aguardando', 'docado', 'carregando', 'descarregando', 'saindo']
const STATUS_ORDER: TruckStatus[] = [
  'carregando', 'descarregando', 'docado', 'chegando', 'aguardando', 'saindo', 'em_transito', 'em_rota', 'entregue',
]

export class TruckSim implements Mover {
  x = SPAWN.x
  z = SPAWN.z
  heading = SPAWN.heading
  targetHeading = SPAWN.heading
  odometer = 0
  path: Waypoint[] = []
  visible = false
  timer = 0
  inFlight = 0
  lanes: (ForkliftSim | null)[] = [null, null]
  holdsDock = false
  doneAt = 0
  /** Seconds spent blocked by another truck. */
  wait = 0
  /** Cooldown before this truck may back off again to unlock a crossing. */
  backoffCd = 0
  constructor(public v: TruckView) {}
}

type ForkPhase = 'idle' | 'charge' | 'toPickup' | 'alignPick' | 'toDrop' | 'alignDrop' | 'return'

interface Task {
  truck: TruckSim
  lane: number
  kind: 'load' | 'unload'
  slot: number
}

export class ForkliftSim implements Mover {
  x: number
  z: number
  heading = -Math.PI / 2
  targetHeading = -Math.PI / 2
  odometer = 0
  path: Waypoint[] = []
  forkY = 0.12
  forkTarget = 0.12
  phase: ForkPhase = 'idle'
  task: Task | null = null
  timer = 0
  cargo: PalletMeta | null = null
  /** Seconds spent blocked; triggers re-planning around the obstacle. */
  wait = 0
  /** Seconds since the last re-plan (throttles A*). */
  replanAt = 0
  constructor(public v: ForkliftView, public home: Vec2) {
    this.x = home.x
    this.z = home.z
  }
}

export interface DockSim {
  v: DockView
  door: number
  truck: TruckSim | null
}

function rackPoint(slot: number): Vec2 {
  const p = slotPosition(slot)
  return { x: p.x, z: p.z + RACK_ACCESS }
}

function zoneName(x: number, z: number) {
  if (FORKLIFT_HOMES.some((h) => Math.hypot(h.x - x, h.z - z) < 1)) return 'Estação de recarga'
  if (z > -5.3) {
    let best = 0
    BAY_X.forEach((bx, i) => { if (Math.abs(bx - x) < Math.abs(BAY_X[best] - x)) best = i })
    return `Área de docas · ${BAY_NAMES[best]}`
  }
  if (z > RACK_ROWS[2].z) return 'Corredor C'
  if (z > RACK_ROWS[1].z) return 'Corredor B'
  return 'Corredor A'
}

class Engine {
  source: LogisticsDataSource = mockDataSource
  ready = false
  time = 0
  private tickAcc = 0
  private lastSpawn = -99
  private loadToken = 0
  private dirty = false
  private eventSeq = 0
  private events: ActivityEvent[] = []
  private history: KpiHistory = { inventory: [], trucksInYard: [], onTimePct: [] }
  private onTime = 0
  private deliveries = 0

  trucks: TruckSim[] = []
  forklifts: ForkliftSim[] = []
  docks: DockSim[] = []
  parking: (TruckSim | null)[] = PARKING.map(() => null)
  /** Only one truck maneuvers in the parking area (P1–P3) at a time. */
  private parkingZone: TruckSim | null = null
  slots: (PalletMeta | null)[] = []
  slotState = new Uint8Array(SLOT_COUNT)
  /** Bumped on every load; 3D components drop cached sim objects when it changes. */
  generation = 0
  /** Bumped whenever rack contents change; the rack renderer watches it. */
  slotsVersion = 0

  // ------------------------------------------------------------------ loading

  async load(warehouseId: string) {
    const token = ++this.loadToken
    this.ready = false
    useSim.setState({ loading: true })
    const firstLoad = this.trucks.length === 0
    const [init] = await Promise.all([
      this.source.load(warehouseId),
      new Promise((r) => setTimeout(r, firstLoad ? 0 : 650)), // let the "switching site" overlay register
    ])
    if (token !== this.loadToken) return
    this.generation++

    this.time = 0
    this.tickAcc = 0
    this.lastSpawn = -99
    this.events = []
    this.parking = PARKING.map(() => null)
    this.parkingZone = null
    this.slots = init.slots.slice()
    this.slotState = new Uint8Array(SLOT_COUNT)
    this.slots.forEach((s, i) => (this.slotState[i] = s ? Slot.Full : Slot.Empty))
    this.slotsVersion++
    this.onTime = init.warehouse.onTimeBase.onTime
    this.deliveries = init.warehouse.onTimeBase.total

    this.docks = BAY_X.map((_, i) => ({
      v: { id: `DOCK-${i + 1}`, index: i, name: BAY_NAMES[i], status: 'livre', truckId: null, movesToday: 20 + ((i * 7 + init.warehouse.seed) % 15) },
      door: 0,
      truck: null,
    }))

    this.forklifts = init.forklifts.map((f, i) => new ForkliftSim(
      { id: f.id, model: f.model, operator: f.operator, status: 'ocioso', battery: f.battery, tasksDone: 0, carrying: false, truckId: null, location: 'Estação de recarga' },
      FORKLIFT_HOMES[i % FORKLIFT_HOMES.length],
    ))

    this.trucks = []
    for (const seed of init.trucks) {
      const t = this.addTruck(seed)
      if (seed.startDocked) {
        const { bay, done } = seed.startDocked
        const dock = this.docks[bay]
        t.v.status = t.v.type === 'outbound' ? 'carregando' : 'descarregando'
        t.v.cargo = t.v.type === 'outbound' ? done : t.v.qty - done
        t.v.bay = bay
        t.v.eta = 0
        t.v.arrivedAt = formatClock(new Date(SIM_START.getTime() - (10 + bay * 6) * 60_000))
        t.visible = true
        t.holdsDock = true
        t.x = BAY_X[bay]
        t.z = DOCK_TRUCK_Z
        t.heading = t.targetHeading = 0
        dock.v.status = 'ocupada'
        dock.v.truckId = t.v.id
        dock.truck = t
        dock.door = 1
      }
    }

    // Seed the sparkline history with a gentle walk towards the current values.
    const k = this.computeKpis()
    const baseline: Kpis = { ...k, inventory: k.inventory - 20, trucksInYard: k.trucksInYard - 1, onTimePct: +(k.onTimePct - 0.4).toFixed(1) }
    this.history = { inventory: [], trucksInYard: [], onTimePct: [] }
    for (let i = 0; i < HISTORY_LEN; i++) {
      const t = i / (HISTORY_LEN - 1)
      const n = Math.sin(i * 1.7) * 0.5 + Math.cos(i * 0.6) * 0.5
      this.history.inventory.push(Math.round(baseline.inventory + (k.inventory - baseline.inventory) * t + n * 3))
      this.history.trucksInYard.push(Math.max(0, Math.round(baseline.trucksInYard + t + n * 0.6)))
      this.history.onTimePct.push(+(baseline.onTimePct + 0.4 * t + n * 0.08).toFixed(2))
    }

    this.log(`Turno iniciado em ${init.warehouse.name}`, 'info')
    this.ready = true
    useSim.setState({ loading: false, baseline })
    this.commit()
    if (!firstLoad) useSim.getState().cameraCmd({ type: 'reset' })
  }

  /** Moves the sim clock forward to the given hour of day (used by the day/night toggle). */
  skipToHour(hour: number) {
    const d = this.simDate()
    const now = d.getHours() + d.getMinutes() / 60
    this.time += ((((hour - now) % 24) + 24) % 24) * 60
    this.log(`Relógio avançado para ${this.clock()}`, 'info')
    this.commit()
  }

  private addTruck(seed: TruckSeed) {
    const t = new TruckSim({
      id: seed.id, plate: seed.plate, carrier: seed.carrier, driver: seed.driver, type: seed.type,
      status: 'em_transito', bay: null, parking: null, qty: seed.qty,
      cargo: seed.type === 'inbound' ? seed.qty : 0,
      target: seed.type === 'outbound' ? seed.qty : 0,
      progress: 0, eta: seed.eta, orderId: seed.orderId, lot: seed.lot, origin: seed.origin,
      destination: seed.destination, arrivedAt: null, onTime: null,
    })
    this.trucks.push(t)
    return t
  }

  // ------------------------------------------------------------------ frame update

  update(realDt: number) {
    if (!this.ready) return
    const { paused, speed } = useSim.getState()
    if (paused) return
    const dt = Math.min(realDt, 0.1) * speed
    this.time += dt

    for (const t of this.trucks) this.updateTruck(t, dt)
    for (const f of this.forklifts) this.updateForklift(f, dt)
    for (const d of this.docks) {
      const s = d.truck?.v.status
      const open = s === 'docado' || s === 'carregando' || s === 'descarregando' ? 1 : 0
      d.door += (open - d.door) * Math.min(1, dt * 1.6)
    }
    this.dispatch()

    this.tickAcc += dt
    let guard = 0
    while (this.tickAcc >= 1 && guard++ < 8) {
      this.tickAcc -= 1
      this.tick()
    }
    if (this.dirty) this.commit()
  }

  private updateTruck(t: TruckSim, frameDt: number) {
    const v = t.v
    // keep distance from the truck ahead (dt is scaled to 0 while blocked)
    const dt = frameDt * (t.visible ? truckTraffic(t, this.trucks, frameDt) : 1)
    switch (v.status) {
      case 'chegando':
        if (this.parkingZone === t && v.bay !== null && t.x < PARKING[0].x - 5) this.parkingZone = null
        if (advance(t, dt, TRUCK_SPEED, 3)) {
          if (v.bay !== null) {
            v.status = 'docado'
            t.timer = 2.5
            v.arrivedAt = this.clock()
            this.docks[v.bay].v.status = 'ocupada'
            this.log(`${v.id} atracou na ${BAY_NAMES[v.bay]}`, 'success')
          } else {
            v.status = 'aguardando'
            if (this.parkingZone === t) this.parkingZone = null
            this.log(`${v.id} aguardando doca na vaga P${(v.parking ?? 0) + 1}`, 'warn')
          }
          this.dirty = true
        }
        break
      case 'docado':
        t.timer -= dt
        if (t.timer <= 0) {
          v.status = v.type === 'outbound' ? 'carregando' : 'descarregando'
          t.timer = 0
          this.dirty = true
        }
        break
      case 'carregando':
      case 'descarregando': {
        const done = v.type === 'outbound' ? v.cargo >= v.target : v.cargo <= 0
        if (done && t.inFlight === 0) {
          t.timer += dt
          if (t.timer > 1.5) this.depart(t)
        }
        break
      }
      case 'saindo':
        if (t.holdsDock && t.z > 15.5) this.releaseDock(t)
        if (advance(t, dt, TRUCK_SPEED, 3)) {
          t.visible = false
          v.status = 'em_rota'
          v.eta = 20 + Math.floor(Math.random() * 25)
          v.onTime = Math.random() < 0.93
          this.log(`${v.id} saiu do pátio rumo a ${v.destination}`, 'info')
          this.dirty = true
        }
        break
      default:
        advance(t, dt, TRUCK_SPEED, 3)
    }
    const qty = Math.max(1, v.qty)
    v.progress = v.type === 'outbound' ? v.cargo / Math.max(1, v.target) : (qty - v.cargo) / qty
  }

  private depart(t: TruckSim) {
    const v = t.v
    v.status = 'saindo'
    t.timer = 0
    t.path = dockToExit(v.bay ?? 0)
    this.log(`${v.id} ${v.type === 'outbound' ? 'carregado' : 'descarregado'}, liberando ${BAY_NAMES[v.bay ?? 0]}`, 'success')
    this.dirty = true
  }

  private releaseDock(t: TruckSim) {
    const bay = t.v.bay
    if (bay === null) return
    const d = this.docks[bay]
    d.v.status = 'livre'
    d.v.truckId = null
    d.truck = null
    t.holdsDock = false
    t.v.bay = null
    this.dirty = true
  }

  private freeDock() {
    const free = this.docks.filter((d) => d.v.status === 'livre')
    return free.length ? free[Math.floor(Math.random() * free.length)].v.index : -1
  }

  private reserveDock(t: TruckSim, bay: number) {
    const d = this.docks[bay]
    d.v.status = 'reservada'
    d.v.truckId = t.v.id
    d.truck = t
    t.holdsDock = true
    t.v.bay = bay
  }

  private tryEnter(t: TruckSim) {
    if (this.time - this.lastSpawn < 4.5) return
    // the road entrance must be clear (a queued truck may still be standing there)
    if (this.trucks.some((o) => o.visible && Math.hypot(o.x - SPAWN.x, o.z - SPAWN.z) < 13)) return
    const bay = this.freeDock()
    if (bay >= 0) {
      this.reserveDock(t, bay)
      t.path = roadToDock(bay)
    } else {
      const p = this.parking.indexOf(null)
      if (p < 0 || this.parkingZone) return // no room / someone maneuvering: wait on the highway shoulder
      this.parkingZone = t
      this.parking[p] = t
      t.v.parking = p
      t.path = roadToParking(p)
    }
    t.x = SPAWN.x
    t.z = SPAWN.z
    t.heading = t.targetHeading = SPAWN.heading
    t.visible = true
    t.v.status = 'chegando'
    this.lastSpawn = this.time
    this.log(`${t.v.id} (${t.v.carrier}) entrou no pátio`, 'info')
  }

  // ------------------------------------------------------------------ forklifts

  private dispatch() {
    for (const t of this.trucks) {
      const v = t.v
      if (v.status !== 'carregando' && v.status !== 'descarregando') continue
      const kind = v.type === 'outbound' ? 'load' : 'unload'
      let remaining = kind === 'load' ? v.target - v.cargo - t.inFlight : v.cargo - t.inFlight
      for (let lane = 0; lane < 2 && remaining > 0; lane++) {
        if (t.lanes[lane]) continue
        const f = this.nearestAvailable(BAY_X[v.bay ?? 0])
        if (!f) return
        const slot = this.pickSlot(kind, BAY_X[v.bay ?? 0])
        if (slot < 0) {
          if (kind === 'load' && t.inFlight === 0 && v.target !== v.cargo) {
            v.target = v.cargo // out of stock: ship what is on board
            this.log(`${v.id}: estoque insuficiente, expedição parcial`, 'warn')
          }
          break
        }
        this.assign(f, t, lane, kind, slot)
        remaining--
      }
    }
  }

  private nearestAvailable(x: number) {
    let best: ForkliftSim | null = null
    let bestD = Infinity
    for (const f of this.forklifts) {
      if (f.v.battery < 25 || (f.phase !== 'idle' && f.phase !== 'return')) continue
      const d = Math.hypot(f.x - x, f.z + 3)
      if (d < bestD) { best = f; bestD = d }
    }
    return best
  }

  private pickSlot(kind: 'load' | 'unload', x: number) {
    const want = kind === 'load' ? Slot.Full : Slot.Empty
    let best = -1
    let bestScore = Infinity
    // levels of one rack column share the same aisle spot: one forklift per column at a time
    const busy = new Set<number>()
    for (let i = 0; i < SLOT_COUNT; i++) if (this.slotState[i] >= Slot.ReservedPick) busy.add(Math.floor(i / RACK_LEVELS.length))
    for (let i = 0; i < SLOT_COUNT; i++) {
      if (this.slotState[i] !== want || busy.has(Math.floor(i / RACK_LEVELS.length))) continue
      const p = slotPosition(i)
      const score = Math.abs(p.x - x) * 0.6 + (2 - p.row) * 2.5 + p.level * 2 + Math.random() * 9
      if (score < bestScore) { bestScore = score; best = i }
    }
    return best
  }

  private assign(f: ForkliftSim, t: TruckSim, lane: number, kind: 'load' | 'unload', slot: number) {
    this.slotState[slot] = kind === 'load' ? Slot.ReservedPick : Slot.ReservedDrop
    t.inFlight++
    t.lanes[lane] = f
    f.task = { truck: t, lane, kind, slot }
    const target = kind === 'load' ? rackPoint(slot) : trailerPoint(t.v.bay ?? 0, lane)
    f.path = findPath(f, target)
    f.phase = 'toPickup'
    f.forkTarget = 0.12
    f.v.status = 'indo_coletar'
    f.v.truckId = t.v.id
    this.dirty = true
  }

  private updateForklift(f: ForkliftSim, dt: number) {
    const k = forkliftTraffic(f, this.forklifts, dt)
    const fd = f.forkTarget - f.forkY
    f.forkY += Math.sign(fd) * Math.min(Math.abs(fd), FORK_SPEED * dt)
    const v = f.v
    const task = f.task
    const aligned = () => Math.abs(angleDelta(f.heading, f.targetHeading)) < 0.06 && Math.abs(f.forkTarget - f.forkY) < 0.01

    switch (f.phase) {
      case 'idle':
        advance(f, dt * k, FORKLIFT_SPEED, 5)
        v.battery = Math.min(100, v.battery + dt * 0.5)
        break
      case 'charge':
        advance(f, dt * k, FORKLIFT_SPEED, 5)
        v.battery = Math.min(100, v.battery + dt * 2.2)
        if (v.battery >= 85) { f.phase = 'idle'; v.status = 'ocioso'; this.dirty = true }
        break
      case 'toPickup':
        if (advance(f, dt * k, FORKLIFT_SPEED, 5) && task) {
          f.phase = 'alignPick'
          f.timer = 0
          f.targetHeading = task.kind === 'load' ? Math.PI : 0
          f.forkTarget = task.kind === 'load' ? slotPosition(task.slot).y : TRAILER_Y
          v.status = 'elevando'
          this.dirty = true
        }
        break
      case 'alignPick':
        advance(f, dt * k, FORKLIFT_SPEED, 5)
        if (task && aligned() && (f.timer += dt) > 0.35) {
          if (task.kind === 'load') {
            f.cargo = this.slots[task.slot]
            this.slots[task.slot] = null
            this.slotState[task.slot] = Slot.Empty
            this.slotsVersion++
          } else {
            task.truck.v.cargo--
            f.cargo = this.source.createPallet({ time: this.time, responsible: v.operator, lot: task.truck.v.lot })
          }
          v.carrying = true
          f.forkTarget = CARRY_Y
          const dest = task.kind === 'load' ? trailerPoint(task.truck.v.bay ?? 0, task.lane) : rackPoint(task.slot)
          f.path = findPath(f, dest)
          f.phase = 'toDrop'
          v.status = 'transportando'
          this.dirty = true
        }
        break
      case 'toDrop':
        if (advance(f, dt * k, FORKLIFT_SPEED * 0.85, 5) && task) {
          f.phase = 'alignDrop'
          f.timer = 0
          f.targetHeading = task.kind === 'load' ? 0 : Math.PI
          f.forkTarget = task.kind === 'load' ? TRAILER_Y : slotPosition(task.slot).y
          v.status = f.forkTarget > CARRY_Y + 0.2 ? 'elevando' : 'baixando'
          this.dirty = true
        }
        break
      case 'alignDrop':
        advance(f, dt * k, FORKLIFT_SPEED, 5)
        if (task && aligned() && (f.timer += dt) > 0.35) {
          const t = task.truck
          if (task.kind === 'load') {
            t.v.cargo++
          } else {
            this.slots[task.slot] = f.cargo
            this.slotState[task.slot] = Slot.Full
            this.slotsVersion++
          }
          if (t.v.bay !== null) this.docks[t.v.bay].v.movesToday++
          t.inFlight--
          t.lanes[task.lane] = null
          f.task = null
          f.cargo = null
          v.carrying = false
          v.tasksDone++
          v.truckId = null
          f.forkTarget = 0.12
          f.path = findPath(f, f.home)
          f.phase = 'return'
          v.status = 'retornando'
          this.dirty = true
        }
        break
      case 'return':
        if (advance(f, dt * k, FORKLIFT_SPEED, 5)) {
          f.targetHeading = -Math.PI / 2
          if (v.battery < 25) {
            f.phase = 'charge'
            v.status = 'recarregando'
            this.log(`${v.id} em recarga (${Math.round(v.battery)}%)`, 'warn')
          } else {
            f.phase = 'idle'
            v.status = 'ocioso'
          }
          this.dirty = true
        }
        break
    }
    if (f.phase !== 'idle' && f.phase !== 'charge') v.battery = Math.max(0, v.battery - dt * 0.32)
  }

  // ------------------------------------------------------------------ discrete tick

  private tick() {
    // trucks waiting in the parking lot get the first free dock
    for (const t of this.trucks) {
      if (t.v.status !== 'aguardando') continue
      const bay = this.freeDock()
      if (bay < 0) break
      if (this.parkingZone) break // wait until the parking area is clear
      this.parkingZone = t
      this.parking[t.v.parking ?? 0] = null
      t.path = parkingToDock(t.v.parking ?? 0, bay)
      t.v.parking = null
      this.reserveDock(t, bay)
      t.v.status = 'chegando'
      this.log(`${t.v.id} liberado para a ${BAY_NAMES[bay]}`, 'info')
    }

    for (const t of this.trucks) {
      const v = t.v
      if (v.status === 'em_transito') {
        v.eta = Math.max(0, v.eta - 1)
        if (v.eta === 0) this.tryEnter(t)
      } else if (v.status === 'em_rota') {
        v.eta = Math.max(0, v.eta - 1)
        if (v.eta === 0) {
          v.status = 'entregue'
          t.doneAt = this.time
          if (v.type === 'outbound') {
            this.deliveries++
            if (v.onTime) this.onTime++
            this.log(`${v.id} entregue em ${v.destination}${v.onTime ? '' : ' (atrasado)'}`, v.onTime ? 'success' : 'warn')
          }
        }
      }
    }
    this.trucks = this.trucks.filter((t) => !(t.v.status === 'entregue' && this.time - t.doneAt > 40))

    const scheduled = this.trucks.filter((t) => t.v.status === 'em_transito').length
    const onSite = this.trucks.filter((t) => YARD_STATUSES.includes(t.v.status)).length
    const k = this.computeKpis()
    for (const e of this.source.poll({ time: this.time, scheduledTrucks: scheduled, trucksOnSite: onSite, fill: k.inventory / k.capacity })) {
      if (e.type === 'truck_scheduled') {
        this.addTruck(e.truck)
        this.log(`Novo agendamento: ${e.truck.id} · ${e.truck.orderId}`, 'info')
      }
    }

    const h = this.history
    h.inventory = [...h.inventory.slice(1 - HISTORY_LEN), k.inventory]
    h.trucksInYard = [...h.trucksInYard.slice(1 - HISTORY_LEN), k.trucksInYard]
    h.onTimePct = [...h.onTimePct.slice(1 - HISTORY_LEN), k.onTimePct]
    this.dirty = true
  }

  // ------------------------------------------------------------------ views

  computeKpis(): Kpis {
    let inventory = 0
    for (let i = 0; i < SLOT_COUNT; i++) if (this.slotState[i] === Slot.Full || this.slotState[i] === Slot.ReservedPick) inventory++
    return {
      inventory,
      capacity: SLOT_COUNT,
      trucksInYard: this.trucks.filter((t) => YARD_STATUSES.includes(t.v.status)).length,
      onTimePct: +((this.onTime / Math.max(1, this.deliveries)) * 100).toFixed(1),
    }
  }

  private simDate() {
    return new Date(SIM_START.getTime() + this.time * 60_000)
  }

  private clock() {
    return formatClock(this.simDate())
  }

  private log(text: string, tone: ActivityEvent['tone']) {
    this.events = [{ id: ++this.eventSeq, time: this.clock(), text, tone }, ...this.events].slice(0, 30)
    this.dirty = true
  }

  private commit() {
    this.dirty = false
    const d = this.simDate()
    for (const f of this.forklifts) f.v.location = zoneName(f.x, f.z)
    const trucks = this.trucks
      .map((t) => ({ ...t.v }))
      .sort((a, b) => STATUS_ORDER.indexOf(a.status) - STATUS_ORDER.indexOf(b.status) || a.eta - b.eta)
    useSim.setState((s) => ({
      version: s.version + 1,
      clock: formatClock(d),
      dateLabel: formatDate(d),
      hour: d.getHours() + d.getMinutes() / 60,
      trucks,
      forklifts: this.forklifts.map((f) => ({ ...f.v, battery: Math.round(f.v.battery) })),
      docks: this.docks.map((x) => ({ ...x.v })),
      kpis: this.computeKpis(),
      history: { ...this.history },
      events: this.events,
    }))
  }

  // ------------------------------------------------------------------ queries for the scene / HUD

  positionOf(sel: Selection): Vec2 | null {
    switch (sel.kind) {
      case 'truck': {
        const t = this.trucks.find((x) => x.v.id === sel.id)
        return t?.visible ? { x: t.x, z: t.z } : null
      }
      case 'forklift': {
        const f = this.forklifts.find((x) => x.v.id === sel.id)
        return f ? { x: f.x, z: f.z } : null
      }
      case 'dock': {
        const i = this.docks.findIndex((x) => x.v.id === sel.id)
        return i >= 0 ? { x: BAY_X[i], z: 1 } : null
      }
      case 'pallet': {
        const p = slotPosition(Number(sel.id))
        return { x: p.x, z: p.z }
      }
    }
  }

  slotInfo(index: number) {
    return { pos: slotPosition(index), meta: this.slots[index], reserved: this.slotState[index] >= Slot.ReservedPick }
  }
}

export const engine = new Engine()
