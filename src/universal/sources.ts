// Data sources: preset demo (with simulated activity), uploaded JSON/CSV, or a live API polled
// every N seconds. Whatever arrives is handed to store.applyRaw(), which animates the differences.
import { useEffect } from 'react'
import { simulateStep } from './demoSim'
import { useUniverse } from './store'
import type { RawData, Row } from './types'

/** Minimal CSV parser (quotes, ; or , separators, header row). */
export function parseCsv(text: string): Row[] {
  const first = text.split(/\r?\n/, 1)[0] ?? ''
  const sep = (first.match(/;/g)?.length ?? 0) > (first.match(/,/g)?.length ?? 0) ? ';' : ','
  const rows: string[][] = []
  let cur: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (quoted) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === sep) { cur.push(cell); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      cur.push(cell); rows.push(cur); cur = []; cell = ''
    } else cell += ch
  }
  if (cell || cur.length) { cur.push(cell); rows.push(cur) }
  const [header, ...body] = rows.filter((r) => r.some((c) => c.trim() !== ''))
  if (!header) return []
  return body.map((r) => Object.fromEntries(header.map((h, i) => [h.trim(), r[i]?.trim() ?? ''])))
}

/** Accepts { tabela: [...] }, a bare array, or { data: { tabela: [...] } } style API envelopes. */
export function toRawData(json: unknown, fallbackName = 'dados'): RawData {
  if (Array.isArray(json)) return { [fallbackName]: json as Row[] }
  if (json && typeof json === 'object') {
    const obj = json as Record<string, unknown>
    const arrays = Object.entries(obj).filter(([, v]) => Array.isArray(v) && (v as unknown[]).every((x) => x && typeof x === 'object'))
    if (arrays.length) return Object.fromEntries(arrays) as RawData
    for (const v of Object.values(obj)) if (v && typeof v === 'object') {
      const inner = toRawData(v, fallbackName)
      if (Object.keys(inner).length) return inner
    }
  }
  throw new Error('Formato não reconhecido: envie um objeto com listas, ex. { "vendas": [ {...} ] }')
}

export async function readFiles(files: FileList | File[]): Promise<RawData> {
  const out: RawData = {}
  for (const f of Array.from(files)) {
    const text = await f.text()
    const name = f.name.replace(/\.[^.]+$/, '').replace(/[^\w]+/g, '_').toLowerCase() || 'dados'
    if (/\.csv$/i.test(f.name)) out[name] = parseCsv(text)
    else Object.assign(out, toRawData(JSON.parse(text), name))
  }
  return out
}

export async function fetchApi(url: string, auth: string): Promise<RawData> {
  const res = await fetch(url, { headers: auth ? { Authorization: auth } : undefined })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  return toRawData(await res.json())
}

/** Drives the dashboard: demo simulation ticks and/or API polling. Mount once. */
export function useUniverseDriver() {
  const { simulate, paused, speed, source, api } = useUniverse()

  // demo activity
  useEffect(() => {
    if (!simulate || paused) return
    const id = setInterval(() => {
      const s = useUniverse.getState()
      s.applyRaw(simulateStep(s.model, s.raw, s.initialSizes))
    }, 1600 / speed)
    return () => clearInterval(id)
  }, [simulate, paused, speed])

  // live API polling
  useEffect(() => {
    if (source !== 'api' || !api.url || paused) return
    let stop = false
    const tick = async () => {
      const s = useUniverse.getState()
      try {
        const raw = await fetchApi(api.url, api.auth)
        if (stop) return
        s.applyRaw(raw)
        s.setApiStatus({ state: 'ok', at: new Date().toLocaleTimeString('pt-BR') })
      } catch (e) {
        if (!stop) s.setApiStatus({ state: 'error', message: e instanceof Error ? e.message : String(e) })
      }
    }
    const id = setInterval(tick, Math.max(3, api.interval) * 1000)
    return () => { stop = true; clearInterval(id) }
  }, [source, api.url, api.auth, api.interval, paused])
}
