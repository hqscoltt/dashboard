// Grid A* over the warehouse floor for forklifts, followed by line-of-sight smoothing.
import { RACK_BAY_XS, RACK_BAY_WIDTH, RACK_DEPTH, RACK_ROWS, WAREHOUSE } from '../data/layout'
import type { Vec2 } from '../data/types'

const CELL = 1
const MIN_X = WAREHOUSE.minX
const MIN_Z = WAREHOUSE.minZ
const COLS = Math.round((WAREHOUSE.maxX - WAREHOUSE.minX) / CELL)
const ROWS = Math.round((WAREHOUSE.maxZ - WAREHOUSE.minZ) / CELL)
const CLEARANCE = 0.9
const WALL_MARGIN = 0.45

type Rect = { x0: number; x1: number; z0: number; z1: number }

const obstacles: Rect[] = []
for (const row of RACK_ROWS) {
  const half = RACK_BAY_WIDTH / 2
  const left = RACK_BAY_XS.filter((x) => x < 0)
  const right = RACK_BAY_XS.filter((x) => x > 0)
  for (const group of [left, right]) {
    obstacles.push({
      x0: Math.min(...group) - half,
      x1: Math.max(...group) + half,
      z0: row.z - RACK_DEPTH / 2,
      z1: row.z + RACK_DEPTH / 2,
    })
  }
}

function blockedAt(x: number, z: number) {
  if (
    x < WAREHOUSE.minX + WALL_MARGIN || x > WAREHOUSE.maxX - WALL_MARGIN ||
    z < WAREHOUSE.minZ + WALL_MARGIN || z > WAREHOUSE.maxZ - WALL_MARGIN
  ) return true
  for (const r of obstacles) {
    if (x > r.x0 - CLEARANCE && x < r.x1 + CLEARANCE && z > r.z0 - CLEARANCE && z < r.z1 + CLEARANCE) return true
  }
  return false
}

const grid = new Uint8Array(COLS * ROWS)
for (let r = 0; r < ROWS; r++)
  for (let c = 0; c < COLS; c++) grid[r * COLS + c] = blockedAt(MIN_X + (c + 0.5) * CELL, MIN_Z + (r + 0.5) * CELL) ? 1 : 0

const toCell = (p: Vec2) => ({
  c: Math.min(COLS - 1, Math.max(0, Math.floor((p.x - MIN_X) / CELL))),
  r: Math.min(ROWS - 1, Math.max(0, Math.floor((p.z - MIN_Z) / CELL))),
})
const center = (c: number, r: number): Vec2 => ({ x: MIN_X + (c + 0.5) * CELL, z: MIN_Z + (r + 0.5) * CELL })
/** Cells temporarily blocked by other forklifts during one search (see findPath's `avoid`). */
let temp: Set<number> | null = null
const free = (c: number, r: number) => c >= 0 && r >= 0 && c < COLS && r < ROWS && grid[r * COLS + c] === 0 && !temp?.has(r * COLS + c)

/** True when a forklift can stand at this point (inside the warehouse, clear of racks). */
export function isWalkable(x: number, z: number) {
  const { c, r } = toCell({ x, z })
  return x > MIN_X && z > MIN_Z && x < WAREHOUSE.maxX && z < WAREHOUSE.maxZ && grid[r * COLS + c] === 0
}

function nearestFree(c: number, r: number) {
  if (free(c, r)) return { c, r }
  for (let rad = 1; rad < 6; rad++)
    for (let dr = -rad; dr <= rad; dr++)
      for (let dc = -rad; dc <= rad; dc++) if (free(c + dc, r + dr)) return { c: c + dc, r: r + dr }
  return { c, r }
}

function lineClear(a: Vec2, b: Vec2) {
  const d = Math.hypot(b.x - a.x, b.z - a.z)
  const steps = Math.ceil(d / 0.25)
  for (let i = 1; i < steps; i++) {
    const t = i / steps
    const { c, r } = toCell({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })
    if (!free(c, r)) return false
  }
  return true
}

const DIRS = [
  [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
  [1, 1, Math.SQRT2], [1, -1, Math.SQRT2], [-1, 1, Math.SQRT2], [-1, -1, Math.SQRT2],
] as const

/** `avoid`: positions of other vehicles to route around (their surrounding cells are blocked). */
export function findPath(from: Vec2, to: Vec2, avoid: Vec2[] = []): Vec2[] {
  const s = nearestFree(toCell(from).c, toCell(from).r)
  const g = nearestFree(toCell(to).c, toCell(to).r)
  if (avoid.length) {
    temp = new Set()
    for (const a of avoid) {
      const ac = toCell(a)
      for (let dr = -1; dr <= 1; dr++)
        for (let dc = -1; dc <= 1; dc++) {
          const i = (ac.r + dr) * COLS + ac.c + dc
          if (i !== s.r * COLS + s.c && i !== g.r * COLS + g.c) temp.add(i)
        }
    }
  }
  try {
    return search(from, to, s, g)
  } finally {
    temp = null
  }
}

function search(from: Vec2, to: Vec2, s: { c: number; r: number }, g: { c: number; r: number }): Vec2[] {
  const N = COLS * ROWS
  const gScore = new Float32Array(N).fill(Infinity)
  const came = new Int32Array(N).fill(-1)
  const closed = new Uint8Array(N)
  const open: number[] = []
  const fScore = new Float32Array(N).fill(Infinity)
  const start = s.r * COLS + s.c
  const goal = g.r * COLS + g.c
  const h = (i: number) => Math.hypot((i % COLS) - g.c, Math.floor(i / COLS) - g.r)
  gScore[start] = 0
  fScore[start] = h(start)
  open.push(start)

  while (open.length) {
    // small grid → linear scan for the best node is fast enough
    let bi = 0
    for (let i = 1; i < open.length; i++) if (fScore[open[i]] < fScore[open[bi]]) bi = i
    const cur = open[bi]
    open[bi] = open[open.length - 1]
    open.pop()
    if (cur === goal) break
    if (closed[cur]) continue
    closed[cur] = 1
    const cc = cur % COLS
    const cr = Math.floor(cur / COLS)
    for (const [dc, dr, cost] of DIRS) {
      const nc = cc + dc
      const nr = cr + dr
      if (!free(nc, nr)) continue
      if (dc && dr && (!free(cc + dc, cr) || !free(cc, cr + dr))) continue // no corner cutting
      const ni = nr * COLS + nc
      const tentative = gScore[cur] + cost
      if (tentative < gScore[ni]) {
        gScore[ni] = tentative
        fScore[ni] = tentative + h(ni)
        came[ni] = cur
        open.push(ni)
      }
    }
  }

  const cells: Vec2[] = []
  if (start === goal || came[goal] !== -1) {
    for (let i = goal; i !== -1 && i !== start; i = came[i]) cells.push(center(i % COLS, Math.floor(i / COLS)))
    cells.reverse()
  }
  const raw = [from, ...cells.slice(0, -1), to]

  // string-pulling: keep only waypoints needed to stay clear of obstacles
  const out: Vec2[] = []
  let anchor = from
  for (let i = 1; i < raw.length; i++) {
    if (i === raw.length - 1 || !lineClear(anchor, raw[i + 1])) {
      out.push(raw[i])
      anchor = raw[i]
    }
  }
  return out
}
