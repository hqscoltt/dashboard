// Turns raw records + a Mapping into the universal model, and guesses a Mapping for unknown data.
import type {
  FlowDef, Format, ItemModel, KpiDef, Mapping, RawData, Row, StageDef, StockDef, UFlow, UKpi, UModel,
  UStage, UStock, Where,
} from './types'

export const STAGE_COLORS = ['#3b82f6', '#06b6d4', '#8b5cf6', '#f59e0b', '#10b981', '#ec4899', '#6366f1', '#14b8a6', '#f97316', '#84cc16']
const FLOW_COLORS = ['#2563eb', '#0891b2', '#7c3aed', '#db2777', '#059669', '#ea580c']

/** Reads "a.b.c" paths so nested API payloads work without reshaping. */
export function getPath(row: Row, path?: string): unknown {
  if (!path) return undefined
  let cur: unknown = row
  for (const part of path.split('.')) {
    if (cur === null || typeof cur !== 'object') return undefined
    cur = (cur as Row)[part]
  }
  return cur
}

export function toNumber(v: unknown): number | null {
  if (typeof v === 'number') return Number.isFinite(v) ? v : null
  if (typeof v === 'string' && v.trim() !== '') {
    // accepts "1.234,56" (pt-BR) and "1234.56"
    const s = v.includes(',') ? v.replace(/\./g, '').replace(',', '.') : v
    const n = Number(s.replace(/[^\d.-]/g, ''))
    return Number.isFinite(n) ? n : null
  }
  return null
}

export function matches(row: Row, where?: Where) {
  if (!where) return true
  return Object.entries(where).every(([k, want]) => {
    const v = getPath(row, k)
    const list = Array.isArray(want) ? want : [want]
    return list.some((w) => String(w) === String(v))
  })
}

export function formatValue(v: number | null | undefined, f: Format = 'number') {
  if (v === null || v === undefined || Number.isNaN(v)) return '—'
  switch (f) {
    case 'currency':
      return v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL', maximumFractionDigits: v >= 10000 ? 0 : 2 })
    case 'percent':
      return `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`
    default:
      return v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
  }
}

export function displayValue(v: unknown): string {
  if (v === null || v === undefined || v === '') return '—'
  if (typeof v === 'object') return JSON.stringify(v)
  return String(v)
}

// words that usually mean "beginning" / "end" / "lost", used to order unknown stages
const START = /novo|nova|aberto|aberta|orcament|orçament|rascunho|pendente|recebid|agendad|lead|backlog|todo|a fazer|aguardando/i
const DONE = /entregue|conclu|finaliz|fechad|ganho|pago|resolvid|done|aprovad|confirmad/i
const LOST = /cancel|perdid|recusad|devolvid|estornad|lost|rejeit/i

function rank(v: string) {
  if (LOST.test(v)) return 3
  if (DONE.test(v)) return 2
  if (START.test(v)) return 0
  return 1
}

function prettify(v: string) {
  const s = v.replace(/[_-]+/g, ' ').trim()
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function buildStages(def: FlowDef, rows: Row[]): UStage[] {
  const out: StageDef[] = [...(def.stages ?? [])]
  const known = new Set(out.map((s) => s.value))
  const found: string[] = []
  for (const r of rows) {
    const v = String(getPath(r, def.stageField) ?? '—')
    if (!known.has(v)) { known.add(v); found.push(v) }
  }
  if (!def.stages?.length) found.sort((a, b) => rank(a) - rank(b))
  // lost/cancelled stages are dead ends; the last stage is always the end of the line
  for (const v of found) out.push({ value: v, label: prettify(v), terminal: LOST.test(v) || undefined })
  return out.map((s, i) => ({ ...s, index: i, color: s.color ?? (LOST.test(s.value) ? '#94a3b8' : STAGE_COLORS[i % STAGE_COLORS.length]) }))
}

function computeKpi(k: KpiDef, raw: RawData): UKpi {
  const rows = raw[k.source] ?? []
  const sel = rows.filter((r) => matches(r, k.where))
  let value = 0
  if (k.op === 'count') value = sel.length
  else if (k.op === 'sum' || k.op === 'avg') {
    const nums = sel.map((r) => toNumber(getPath(r, k.field)) ?? 0)
    value = nums.reduce((a, b) => a + b, 0)
    if (k.op === 'avg') value = nums.length ? value / nums.length : 0
  } else if (k.op === 'ratio') {
    const base = rows.filter((r) => matches(r, k.of)).length
    value = base ? (sel.length / base) * 100 : 0
  }
  return { label: k.label, value, format: k.format ?? (k.op === 'ratio' ? 'percent' : 'number') }
}

export function normalize(mapping: Mapping, raw: RawData, palletUnits: Record<string, number> = {}): UModel {
  const flows: UFlow[] = mapping.flows.map((def, fi) => {
    const rows = raw[def.source] ?? []
    const stages = buildStages(def, rows)
    const items = rows.map((r, i) => {
      const id = String(getPath(r, def.idField) ?? i)
      return {
        key: `${def.id}:${id}`,
        id,
        flowId: def.id,
        title: String(getPath(r, def.titleField) ?? id),
        stage: String(getPath(r, def.stageField) ?? '—'),
        value: toNumber(getPath(r, def.valueField)),
        raw: r,
      }
    })
    return { def, stages, items, color: def.color ?? FLOW_COLORS[fi % FLOW_COLORS.length], model: def.model ?? 'caixa' }
  })

  const stocks: UStock[] = mapping.stocks.map((def) => {
    const rows = raw[def.source] ?? []
    const items = rows.map((r, i) => {
      const id = String(getPath(r, def.idField) ?? i)
      const qty = Math.max(0, toNumber(getPath(r, def.qtyField)) ?? 0)
      return {
        key: `${def.id}:${id}`,
        id,
        stockId: def.id,
        title: String(getPath(r, def.titleField) ?? id),
        qty,
        group: String(getPath(r, def.groupField) ?? 'Geral'),
        low: def.lowAt !== undefined ? qty <= def.lowAt : false,
        raw: r,
      }
    })
    const groups = [...new Set(items.map((i) => i.group))]
    const total = items.reduce((a, b) => a + b.qty, 0)
    if (!palletUnits[def.id]) palletUnits[def.id] = def.unitsPerPallet ?? Math.max(1, Math.ceil(total / 360))
    return { def, items, groups, total }
  })

  return { flows, stocks, kpis: mapping.kpis.map((k) => computeKpi(k, raw)) }
}

// ---------------------------------------------------------------------------
// Auto-mapping: makes "any data" work out of the box. The result is editable.
// ---------------------------------------------------------------------------

const ID_RX = /^(id|_id|uuid|codigo|código|code|numero|número|num|sku)$/i
const TITLE_RX = /^(nome|name|titulo|título|title|descricao|descrição|description|cliente|produto|assunto|numero|número)$/i
const STAGE_RX = /(status|etapa|situac|situaç|stage|fase|estado|state|pipeline)/i
const VALUE_RX = /(total|valor|value|amount|preco|preço|price|receita)/i
const QTY_RX = /(saldo|quantidade|qtd|qty|estoque|stock|quantity)/i
const GROUP_RX = /(categoria|category|grupo|group|tipo|type|setor|departamento)/i
const PERSON_RX = /(lead|cliente|paciente|aluno|candidat|contato|pessoa|funcion|usuario|usuário|ticket|atendiment)/i
const VEHICLE_RX = /(entrega|frete|caminh|veicul|veícul|rota|viagem|transport|pedido)/i
const DOC_RX = /(fatura|nota|contrato|documento|proposta|boleto|conta|os|ordem)/i

function fieldsOf(rows: Row[]) {
  const keys = new Set<string>()
  rows.slice(0, 50).forEach((r) => Object.keys(r).forEach((k) => keys.add(k)))
  return [...keys]
}

function distinct(rows: Row[], f: string) {
  return new Set(rows.map((r) => String(r[f]))).size
}

function guessModel(name: string): ItemModel {
  if (PERSON_RX.test(name)) return 'pessoa'
  if (VEHICLE_RX.test(name)) return 'veiculo'
  if (DOC_RX.test(name)) return 'documento'
  return 'caixa'
}

export function autoMapping(raw: RawData, name = 'Meus dados'): Mapping {
  const flows: FlowDef[] = []
  const stocks: StockDef[] = []
  const kpis: KpiDef[] = []
  for (const [source, rows] of Object.entries(raw)) {
    if (!Array.isArray(rows) || !rows.length) continue
    const fields = fieldsOf(rows)
    const numeric = (f: string) => rows.slice(0, 30).every((r) => r[f] === null || r[f] === undefined || toNumber(r[f]) !== null)
    const idField = fields.find((f) => ID_RX.test(f) && distinct(rows, f) === rows.length) ?? fields.find((f) => distinct(rows, f) === rows.length) ?? fields[0]
    const titleField = fields.find((f) => TITLE_RX.test(f) && f !== idField) ?? idField
    const stageField =
      fields.find((f) => STAGE_RX.test(f) && distinct(rows, f) <= 15) ??
      fields.find((f) => !numeric(f) && f !== idField && f !== titleField && distinct(rows, f) >= 2 && distinct(rows, f) <= 8)
    const valueField = fields.find((f) => VALUE_RX.test(f) && numeric(f))
    const qtyField = fields.find((f) => QTY_RX.test(f) && numeric(f))
    const label = prettify(source)

    if (stageField && !(qtyField && !STAGE_RX.test(stageField))) {
      flows.push({
        id: source, label, source, idField, titleField, stageField, valueField,
        valueFormat: valueField ? 'currency' : undefined, model: guessModel(source),
      })
      kpis.push({ label: `${label} (total)`, source, op: 'count' })
      if (valueField) kpis.push({ label: `Valor em ${label.toLowerCase()}`, source, op: 'sum', field: valueField, format: 'currency' })
    } else if (qtyField) {
      const groupField = fields.find((f) => GROUP_RX.test(f) && distinct(rows, f) <= 12)
      stocks.push({ id: source, label, source, idField, titleField, qtyField, groupField })
      kpis.push({ label: `${label}: unidades`, source, op: 'sum', field: qtyField })
    }
  }
  return { name, hq: 'Sede', flows, stocks, kpis: kpis.slice(0, 4) }
}
