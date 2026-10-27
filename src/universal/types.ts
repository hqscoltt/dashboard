// Universal model: any system's data is described as FLOWS (records moving through stages),
// STOCKS (quantities that pile up) and KPIs. A Mapping tells the engine how to read raw data.

export type ItemModel = 'caixa' | 'pessoa' | 'documento' | 'veiculo'
export type Format = 'number' | 'currency' | 'percent' | 'text'
export type WhereValue = string | number | boolean | (string | number | boolean)[]
export type Where = Record<string, WhereValue>

export interface StageDef {
  value: string
  label: string
  color?: string
  /** End of the line (delivered, lost, cancelled). Demo simulation never advances past it. */
  terminal?: boolean
}

export interface FlowDef {
  id: string
  label: string
  /** Key of the array inside the raw data object (e.g. "vendas"). */
  source: string
  idField: string
  titleField?: string
  stageField: string
  valueField?: string
  valueFormat?: Format
  /** Optional: fixes order/labels/colors. Values found in the data but missing here are appended. */
  stages?: StageDef[]
  model?: ItemModel
  color?: string
  /** Fields shown in the details panel (all fields when omitted). */
  details?: string[]
}

export interface StockDef {
  id: string
  label: string
  source: string
  idField: string
  titleField?: string
  qtyField: string
  groupField?: string
  unit?: string
  /** How many units one pallet represents (auto when omitted). */
  unitsPerPallet?: number
  /** Items at or below this quantity are flagged. */
  lowAt?: number
  details?: string[]
}

export interface KpiDef {
  label: string
  source: string
  op: 'count' | 'sum' | 'avg' | 'ratio'
  field?: string
  where?: Where
  /** For op = 'ratio': percentage of `where` over `of` (both counts). */
  of?: Where
  format?: Format
}

export interface Mapping {
  name: string
  subtitle?: string
  /** Label of the main building (headquarters) that holds the KPI screens. */
  hq?: string
  flows: FlowDef[]
  stocks: StockDef[]
  kpis: KpiDef[]
}

export type Row = Record<string, unknown>
export type RawData = Record<string, Row[]>

// ---- normalized model ------------------------------------------------------

export interface UItem {
  key: string // `${flowId}:${id}`
  id: string
  flowId: string
  title: string
  stage: string
  value: number | null
  raw: Row
}

export interface UStage extends StageDef {
  index: number
  color: string
}

export interface UFlow {
  def: FlowDef
  stages: UStage[]
  items: UItem[]
  color: string
  model: ItemModel
}

export interface UStockItem {
  key: string // `${stockId}:${id}`
  id: string
  stockId: string
  title: string
  qty: number
  group: string
  low: boolean
  raw: Row
}

export interface UStock {
  def: StockDef
  items: UStockItem[]
  groups: string[]
  total: number
}

export interface UKpi {
  label: string
  value: number
  format: Format
}

export interface UModel {
  flows: UFlow[]
  stocks: UStock[]
  kpis: UKpi[]
}

export type USelection =
  | { kind: 'item'; key: string }
  | { kind: 'building'; id: string }
  | { kind: 'stockItem'; key: string }
  | { kind: 'truck'; key: string }
