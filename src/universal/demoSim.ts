// Generic demo activity: advances records through their stages, creates and archives records,
// moves stock quantities. Works for ANY mapping because it only uses the mapping's field names.
import { getPath, toNumber } from './mapping'
import type { FlowDef, RawData, Row, UModel } from './types'

function setPath(row: Row, path: string, value: unknown): Row {
  const parts = path.split('.')
  const out: Row = { ...row }
  let cur: Row = out
  parts.forEach((p, i) => {
    if (i === parts.length - 1) cur[p] = value
    else {
      cur[p] = { ...((cur[p] as Row) ?? {}) }
      cur = cur[p] as Row
    }
  })
  return out
}

const rnd = (n: number) => Math.floor(Math.random() * n)

function newId(rows: Row[], idField: string): string | number {
  const ids = rows.map((r) => getPath(r, idField))
  const nums = ids.map((v) => toNumber(v)).filter((v): v is number => v !== null)
  if (nums.length === ids.length && typeof ids[0] === 'number') return Math.max(...nums) + 1
  const sample = String(ids[0] ?? 'ID-1')
  const m = sample.match(/^(.*?)(\d+)$/)
  const max = Math.max(0, ...ids.map((v) => Number(String(v).match(/(\d+)$/)?.[1] ?? 0)))
  return m ? `${m[1]}${max + 1}` : `${sample}-${max + 1}`
}

function createRecord(rows: Row[], mapping: FlowDef, stage: string): Row {
  const base = rows.length ? rows[rnd(rows.length)] : {}
  const id = newId(rows, mapping.idField)
  let row = setPath(base, mapping.idField, id)
  const title = getPath(base, mapping.titleField)
  if (mapping.titleField && String(title) === String(getPath(base, mapping.idField))) row = setPath(row, mapping.titleField, id)
  row = setPath(row, mapping.stageField, stage)
  const value = toNumber(getPath(base, mapping.valueField))
  if (mapping.valueField && value !== null) row = setPath(row, mapping.valueField, Math.round(value * (0.6 + Math.random() * 0.8) * 100) / 100)
  return row
}

export function simulateStep(model: UModel, raw: RawData, initialSizes: Record<string, number>): RawData {
  const next: RawData = { ...raw }

  model.flows.forEach((flow) => {
    const def = flow.def
    let rows = [...(next[def.source] ?? [])]
    const order = flow.stages.filter((s) => !s.terminal)
    const lost = flow.stages.filter((s) => s.terminal)
    const changes = 1 + rnd(2)
    for (let c = 0; c < changes; c++) {
      const roll = Math.random()
      if (roll < 0.62 && rows.length) {
        // advance one record to its next stage (rarely to a dead-end stage such as "cancelada")
        for (let tries = 0; tries < 6; tries++) {
          const i = rnd(rows.length)
          const cur = String(getPath(rows[i], def.stageField))
          const idx = order.findIndex((s) => s.value === cur)
          if (idx < 0 || idx >= order.length - 1) continue
          const to = lost.length && Math.random() < 0.08 ? lost[rnd(lost.length)] : order[idx + 1]
          rows[i] = setPath(rows[i], def.stageField, to.value)
          break
        }
      } else if (roll < 0.86 && order.length) {
        rows.push(createRecord(rows, def, order[0].value))
      } else {
        // archive something that already finished, keeping the dataset size stable
        const limit = (initialSizes[def.id] ?? rows.length) * 1.25
        if (rows.length > limit) {
          const ends = new Set([order[order.length - 1]?.value, ...lost.map((s) => s.value)])
          const i = rows.findIndex((r) => ends.has(String(getPath(r, def.stageField))))
          if (i >= 0) rows.splice(i, 1)
        }
      }
    }
    next[def.source] = rows
  })

  model.stocks.forEach((stock) => {
    const def = stock.def
    const rows = [...(next[def.source] ?? [])]
    for (let c = 0; c < 2 && rows.length; c++) {
      const i = rnd(rows.length)
      const q = toNumber(getPath(rows[i], def.qtyField)) ?? 0
      const delta = Math.random() < 0.12 ? 20 + rnd(60) : -rnd(9) + rnd(4)
      rows[i] = setPath(rows[i], def.qtyField, Math.max(0, q + delta))
    }
    next[def.source] = rows
  })
  return next
}

/** Adds `n` records spread across stages — used by the "+ volume" button to show buildings expanding. */
export function addVolume(model: UModel, raw: RawData, n: number): RawData {
  const next: RawData = { ...raw }
  model.flows.forEach((flow) => {
    const rows = [...(next[flow.def.source] ?? [])]
    const order = flow.stages.filter((s) => !s.terminal)
    for (let i = 0; i < Math.ceil(n / model.flows.length); i++) {
      rows.push(createRecord(rows, flow.def, order[Math.min(order.length - 1, rnd(order.length))].value))
    }
    next[flow.def.source] = rows
  })
  model.stocks.forEach((stock) => {
    next[stock.def.source] = (next[stock.def.source] ?? []).map((r) => {
      const q = toNumber(getPath(r, stock.def.qtyField)) ?? 0
      return setPath(r, stock.def.qtyField, Math.round(q * 1.6 + 10))
    })
  })
  return next
}
