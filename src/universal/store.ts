// State of the universal dashboard. New data snapshots are diffed against the previous one:
// records that changed stage are carried by truck between warehouses (see fleet.ts); new ones
// arrive from the road. Warehouses are sized from what they hold (see layout.ts).
import { create } from 'zustand'
import { configureFleet, enqueue, enqueueStock, resetFleet } from './fleet'
import { computeLayout, type Layout } from './layout'
import { autoMapping, normalize } from './mapping'
import { itemColor } from './scene/itemModels'
import { PRESETS } from './presets'
import type { Mapping, RawData, UModel, USelection } from './types'

export type SourceKind = 'preset' | 'file' | 'api'
export type Speed = 1 | 2 | 4

export interface ApiConfig {
  url: string
  interval: number // seconds
  auth: string // optional Authorization header value
}

export interface UEvent {
  id: number
  time: string
  text: string
  color: string
}

type CameraCmd =
  | { type: 'zoomIn' | 'zoomOut' | 'reset' | 'rotateLeft' | 'rotateRight'; nonce: number }
  | { type: 'focus'; x: number; z: number; zoom?: number; nonce: number }

interface UState {
  source: SourceKind
  presetId: string
  mapping: Mapping
  raw: RawData
  model: UModel
  palletUnits: Record<string, number>
  initialSizes: Record<string, number>
  /** Records being moved: `at` = warehouse still holding it (until loaded), null = on a truck. */
  transit: Record<string, Transit>
  counts: Record<string, number>
  contents: Record<string, string[]>
  layout: Layout
  version: number

  kpiHistory: number[][]
  kpiBaseline: number[]
  events: UEvent[]

  simulate: boolean
  paused: boolean
  speed: Speed
  api: ApiConfig
  apiStatus: { state: 'idle' | 'ok' | 'error' | 'loading'; message?: string; at?: string }

  selected: USelection | null
  hovered: { label: string; sub?: string } | null
  inside: string | null
  camera: CameraCmd | null
  panelOpen: boolean

  loadPreset: (id: string) => void
  loadData: (raw: RawData, mapping: Mapping | null, source: SourceKind) => void
  setMapping: (m: Mapping) => void
  applyRaw: (raw: RawData) => void
  pickup: (keys: string[]) => void
  deliver: (keys: string[]) => void
  select: (s: USelection | null) => void
  setHovered: (h: UState['hovered']) => void
  enter: (id: string) => void
  exit: () => void
  cameraCmd: (c: { type: 'zoomIn' | 'zoomOut' | 'reset' | 'rotateLeft' | 'rotateRight' } | { type: 'focus'; x: number; z: number; zoom?: number }) => void
  setSpeed: (s: Speed) => void
  togglePause: () => void
  setSimulate: (on: boolean) => void
  setApi: (a: Partial<ApiConfig>) => void
  setApiStatus: (s: UState['apiStatus']) => void
  setPanelOpen: (o: boolean) => void
}

export interface Transit {
  at: string | null
  to: string | null
}

const ENTRY_LIMIT = 80 // animated transfers per snapshot; the rest is applied instantly

function bucket(model: UModel, transit: Record<string, Transit>) {
  const contents: Record<string, string[]> = {}
  const counts: Record<string, number> = {}
  for (const f of model.flows) {
    for (const st of f.stages) contents[`stage:${f.def.id}:${st.value}`] = []
    for (const it of f.items) {
      const tr = transit[it.key]
      if (tr) {
        if (tr.at) (contents[tr.at] ??= []).push(it.key) // waiting for its truck
        continue
      }
      const id = `stage:${f.def.id}:${it.stage}`
      ;(contents[id] ??= []).push(it.key)
    }
  }
  for (const [id, keys] of Object.entries(contents)) counts[id] = keys.length
  return { contents, counts }
}

/** Warehouse capacities of the current site (see layout.capacity). */
let caps: Record<string, number> = {}

function clock() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
}

function sizesOf(model: UModel) {
  return Object.fromEntries(model.flows.map((f) => [f.def.id, f.items.length]))
}

function fresh(mapping: Mapping, raw: RawData) {
  const palletUnits: Record<string, number> = {}
  const model = normalize(mapping, raw, palletUnits)
  const { contents, counts } = bucket(model, {})
  const layout = computeLayout(model, counts, palletUnits, mapping.hq ?? mapping.name, (caps = {}))
  const values = model.kpis.map((k) => k.value)
  return {
    mapping, raw, model, palletUnits, contents, counts, layout, transit: {},
    initialSizes: sizesOf(model),
    kpiBaseline: values,
    kpiHistory: values.map((v) => Array(30).fill(v)),
    selected: null, inside: null,
  }
}

const SAVE_KEY = 'Trycol:universe'

function restore(): Partial<{ source: SourceKind; presetId: string; mapping: Mapping; raw: RawData; api: ApiConfig }> {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export function persist() {
  const s = useUniverse.getState()
  try {
    const data: Record<string, unknown> = { source: s.source, presetId: s.presetId, api: s.api }
    if (s.source !== 'preset') data.mapping = s.mapping
    if (s.source === 'file') {
      const raw = JSON.stringify(s.raw)
      if (raw.length < 2_000_000) data.raw = s.raw
    }
    localStorage.setItem(SAVE_KEY, JSON.stringify(data))
  } catch {
    /* storage unavailable: nothing to persist */
  }
}

function initial() {
  const saved = restore()
  const preset = PRESETS.find((p) => p.id === saved.presetId) ?? PRESETS[0]
  if (saved.source === 'file' && saved.raw && saved.mapping) {
    return { source: 'file' as SourceKind, presetId: preset.id, api: saved.api, ...fresh(saved.mapping, saved.raw) }
  }
  return { source: 'preset' as SourceKind, presetId: preset.id, api: saved.api, ...fresh(preset.mapping, preset.data()) }
}

const boot = initial()

export const useUniverse = create<UState>()((set, get) => ({
  ...boot,
  version: 0,
  events: [],
  simulate: boot.source === 'preset',
  paused: false,
  speed: 1,
  api: boot.api ?? { url: '', interval: 15, auth: '' },
  apiStatus: { state: 'idle' },
  hovered: null,
  camera: null,
  panelOpen: false,

  loadPreset: (id) => {
    const p = PRESETS.find((x) => x.id === id) ?? PRESETS[0]
    resetFleet()
    set({ ...fresh(p.mapping, p.data()), source: 'preset', presetId: p.id, simulate: true, events: [], version: get().version + 1 })
    get().cameraCmd({ type: 'reset' })
    persist()
  },

  loadData: (raw, mapping, source) => {
    resetFleet()
    const m = mapping ?? autoMapping(raw)
    set({ ...fresh(m, raw), source, simulate: false, events: [], version: get().version + 1 })
    get().cameraCmd({ type: 'reset' })
    persist()
  },

  setMapping: (m) => {
    resetFleet()
    set({ ...fresh(m, get().raw), events: [], version: get().version + 1 })
    persist()
  },

  applyRaw: (raw) => {
    const s = get()
    const model = normalize(s.mapping, raw, s.palletUnits)
    const prev = new Map(s.model.flows.flatMap((f) => f.items.map((i) => [i.key, i] as const)))
    const transit = { ...s.transit }
    const events: UEvent[] = []
    let seq = s.events[0]?.id ?? 0
    let moved = 0

    for (const f of model.flows) {
      for (const it of f.items) {
        const before = prev.get(it.key)
        prev.delete(it.key)
        if (before && before.stage === it.stage) continue
        const to = `stage:${f.def.id}:${it.stage}`
        const st = f.stages.find((x) => x.value === it.stage)
        events.push({ id: ++seq, time: clock(), color: st?.color ?? f.color, text: before ? `${f.def.label}: ${it.title} → ${st?.label ?? it.stage}` : `${f.def.label}: novo ${it.title} (${st?.label ?? it.stage})` })
        if (moved++ >= ENTRY_LIMIT) { delete transit[it.key]; continue }
        const cur = transit[it.key]
        // still waiting at the origin: keep it there; already on a truck: it lands on arrival
        const from = cur ? cur.at : before ? `stage:${f.def.id}:${before.stage}` : null
        if (cur && cur.at === null) { transit[it.key] = { at: null, to }; continue }
        if (from === to) { delete transit[it.key]; continue }
        transit[it.key] = { at: from, to }
        enqueue({ key: it.key, from, to, road: f.def.id })
      }
    }
    for (const gone of prev.values()) delete transit[gone.key]

    // stock movements bring delivery / pickup trucks to the stock warehouses
    for (const st of model.stocks) {
      const old = s.model.stocks.find((x) => x.def.id === st.def.id)
      if (!old) continue
      const delta = st.total - old.total
      if (delta) enqueueStock(`stock:${st.def.id}`, delta > 0, Math.min(3, Math.ceil(Math.abs(delta) / (s.palletUnits[st.def.id] ?? 1))))
    }

    const { contents, counts } = bucket(model, transit)
    const values = model.kpis.map((k) => k.value)
    set({
      raw, model, transit, contents, counts,
      layout: computeLayout(model, counts, s.palletUnits, s.mapping.hq ?? s.mapping.name, caps),
      kpiHistory: values.map((v, i) => [...(s.kpiHistory[i] ?? []).slice(-39), v]),
      kpiBaseline: s.kpiBaseline.length === values.length ? s.kpiBaseline : values,
      events: [...events.reverse(), ...s.events].slice(0, 60),
      version: s.version + 1,
    })
    if (s.source === 'file') persist()
  },

  pickup: (keys) => {
    const s = get()
    const transit = { ...s.transit }
    keys.forEach((k) => { if (transit[k]) transit[k] = { ...transit[k], at: null } })
    const { contents, counts } = bucket(s.model, transit)
    set({ transit, contents, counts, layout: computeLayout(s.model, counts, s.palletUnits, s.mapping.hq ?? s.mapping.name, caps) })
  },

  deliver: (keys) => {
    const s = get()
    const transit = { ...s.transit }
    keys.forEach((k) => delete transit[k])
    const { contents, counts } = bucket(s.model, transit)
    set({ transit, contents, counts, layout: computeLayout(s.model, counts, s.palletUnits, s.mapping.hq ?? s.mapping.name, caps) })
  },

  select: (selected) => set({ selected }),
  setHovered: (hovered) => set({ hovered }),
  enter: (id) => {
    const b = get().layout.buildings[id]
    if (!b) return
    set({ inside: id, selected: { kind: 'building', id } })
    const zoom = Math.min(42, Math.max(14, 900 / Math.max(b.w, b.d * 1.4)))
    get().cameraCmd({ type: 'focus', x: b.x + b.w / 2, z: b.z - b.d / 2, zoom })
  },
  exit: () => {
    const id = get().inside
    const b = id ? get().layout.buildings[id] : null
    set({ inside: null })
    if (b) get().cameraCmd({ type: 'focus', x: b.x + b.w / 2, z: b.z - b.d / 2, zoom: 11 })
  },
  cameraCmd: (c) => set({ camera: { ...c, nonce: Math.random() } as CameraCmd }),
  setSpeed: (speed) => set({ speed, paused: false }),
  togglePause: () => set((s) => ({ paused: !s.paused })),
  setSimulate: (simulate) => set({ simulate }),
  setApi: (a) => { set((s) => ({ api: { ...s.api, ...a } })); persist() },
  setApiStatus: (apiStatus) => set({ apiStatus }),
  setPanelOpen: (panelOpen) => set({ panelOpen }),
}))

// the fleet reads the layout and reports pickups / deliveries back to the store
configureFleet({
  layout: () => useUniverse.getState().layout,
  contents: (id) => useUniverse.getState().contents[id] ?? [],
  colorOf: (key) => {
    const s = useUniverse.getState()
    const f = s.model.flows.find((x) => key.startsWith(`${x.def.id}:`))
    return f ? `#${itemColor(f.model, f.color, key).getHexString()}` : '#c8a27a'
  },
  onPickup: (keys) => useUniverse.getState().pickup(keys),
  onDeliver: (keys) => useUniverse.getState().deliver(keys),
  clock: () => ({ paused: useUniverse.getState().paused, speed: useUniverse.getState().speed }),
})
