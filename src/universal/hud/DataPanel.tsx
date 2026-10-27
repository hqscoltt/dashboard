import { useState } from 'react'
import { useShallow } from 'zustand/react/shallow'
import { Icon } from '../../components/Icon'
import { autoMapping } from '../mapping'
import { PRESETS } from '../presets'
import { fetchApi, readFiles } from '../sources'
import { useUniverse } from '../store'
import type { Mapping } from '../types'

type Tab = 'exemplos' | 'arquivo' | 'api' | 'mapa'

const EXAMPLE = `{
  "vendas": [
    { "id": 1, "cliente": "Ana", "status": "aberta", "total": 120.5 },
    { "id": 2, "cliente": "Bruno", "status": "paga", "total": 89.9 }
  ],
  "produtos": [
    { "sku": "A1", "nome": "Café", "categoria": "Bebidas", "saldo": 40 }
  ]
}`

export function DataPanel() {
  const { open, source, mapping, api, apiStatus, raw } = useUniverse(useShallow((s) => ({ open: s.panelOpen, source: s.source, mapping: s.mapping, api: s.api, apiStatus: s.apiStatus, raw: s.raw })))
  const [tab, setTab] = useState<Tab>('exemplos')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [draft, setDraft] = useState<string | null>(null)
  const [form, setForm] = useState(api)
  if (!open) return null
  const s = useUniverse.getState()
  const close = () => { s.setPanelOpen(false); setError(null) }
  const mappingText = draft ?? JSON.stringify(mapping, null, 2)

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return
    setError(null)
    try {
      const data = await readFiles(files)
      s.loadData(data, null, 'file')
      setDraft(null)
      setTab('mapa')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const connect = async () => {
    setBusy(true)
    setError(null)
    try {
      const data = await fetchApi(form.url, form.auth)
      s.setApi(form)
      s.loadData(data, s.source === 'api' && s.api.url === form.url ? s.mapping : null, 'api')
      s.setApiStatus({ state: 'ok', at: new Date().toLocaleTimeString('pt-BR') })
      setDraft(null)
      setTab('mapa')
    } catch (e) {
      setError(`Não consegui ler a API: ${e instanceof Error ? e.message : String(e)}. Verifique a URL, o token e se a API permite CORS para este endereço.`)
    } finally {
      setBusy(false)
    }
  }

  const applyMapping = () => {
    try {
      const m = JSON.parse(mappingText) as Mapping
      if (!Array.isArray(m.flows) || !Array.isArray(m.stocks) || !Array.isArray(m.kpis)) throw new Error('o mapeamento precisa de "flows", "stocks" e "kpis" (listas)')
      s.setMapping(m)
      setDraft(null)
      setError(null)
    } catch (e) {
      setError(`Mapeamento inválido: ${e instanceof Error ? e.message : String(e)}`)
    }
  }

  const tabs: { id: Tab; label: string }[] = [
    { id: 'exemplos', label: 'Exemplos' },
    { id: 'arquivo', label: 'Arquivo' },
    { id: 'api', label: 'API' },
    { id: 'mapa', label: 'Mapeamento' },
  ]

  return (
    <div className="pointer-events-auto fixed inset-0 z-50 grid place-items-center bg-slate-900/30 p-6 backdrop-blur-sm" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div className="glass flex max-h-[86vh] w-[760px] max-w-full flex-col overflow-hidden bg-white/90">
        <div className="flex items-center justify-between border-b border-slate-200/70 px-5 py-4">
          <div>
            <h2 className="text-lg font-extrabold text-slate-900">Fonte de dados</h2>
            <p className="text-xs text-slate-500">Qualquer dado vira cenário: listas com status viram ruas com prédios por etapa, listas com quantidade viram armazéns.</p>
          </div>
          <button onClick={close} className="grid h-8 w-8 place-items-center rounded-lg text-slate-400 hover:bg-slate-100"><Icon name="x" /></button>
        </div>
        <div className="flex gap-1 border-b border-slate-200/70 px-5 py-2">
          {tabs.map((t) => (
            <button key={t.id} onClick={() => { setTab(t.id); setError(null) }} className={`rounded-lg px-3 py-1.5 text-sm font-semibold ${tab === t.id ? 'bg-blue-600 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>{t.label}</button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-5 text-sm text-slate-700 scrollbar-thin">
          {tab === 'exemplos' && (
            <div className="grid gap-3 sm:grid-cols-2">
              {PRESETS.map((p) => (
                <button key={p.id} onClick={() => { s.loadPreset(p.id); setDraft(null); close() }} className="rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-blue-400 hover:shadow">
                  <div className="font-bold text-slate-900">{p.label}</div>
                  <div className="mt-1 text-xs text-slate-500">{p.description}</div>
                </button>
              ))}
            </div>
          )}

          {tab === 'arquivo' && (
            <div className="space-y-4">
              <label
                className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-slate-300 bg-white/60 p-8 text-center hover:border-blue-400"
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => { e.preventDefault(); void onFiles(e.dataTransfer.files) }}
              >
                <Icon name="arrowUp" className="h-6 w-6 text-blue-600" />
                <span className="font-semibold text-slate-800">Arraste arquivos JSON ou CSV aqui</span>
                <span className="text-xs text-slate-500">Cada CSV vira uma lista com o nome do arquivo. O mapeamento é gerado automaticamente e pode ser ajustado depois.</span>
                <input type="file" accept=".json,.csv" multiple className="hidden" onChange={(e) => void onFiles(e.target.files)} />
              </label>
              <div>
                <div className="mb-1 text-xs font-semibold text-slate-500">Formato JSON esperado</div>
                <pre className="overflow-x-auto rounded-xl bg-slate-900 p-3 text-[12px] leading-relaxed text-slate-100">{EXAMPLE}</pre>
              </div>
            </div>
          )}

          {tab === 'api' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">A API deve devolver JSON com listas, por exemplo <code className="rounded bg-slate-100 px-1">{'{ "vendas": [...], "produtos": [...] }'}</code>. O painel consulta no intervalo escolhido e anima só o que mudou.</p>
              <label className="block">
                <span className="text-xs font-semibold text-slate-500">URL</span>
                <input value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} placeholder="https://api.seusistema.com.br/dashboard" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400/60" />
              </label>
              <div className="flex gap-3">
                <label className="block flex-1">
                  <span className="text-xs font-semibold text-slate-500">Cabeçalho Authorization (opcional)</span>
                  <input value={form.auth} onChange={(e) => setForm({ ...form, auth: e.target.value })} placeholder="Bearer …" type="password" autoComplete="off" className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400/60" />
                </label>
                <label className="block w-32">
                  <span className="text-xs font-semibold text-slate-500">Intervalo (s)</span>
                  <input type="number" min={3} value={form.interval} onChange={(e) => setForm({ ...form, interval: Number(e.target.value) || 15 })} className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400/60" />
                </label>
              </div>
              <div className="flex items-center gap-3">
                <button disabled={!form.url || busy} onClick={() => void connect()} className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white disabled:opacity-50">{busy ? 'Conectando…' : 'Conectar'}</button>
                {source === 'api' && <span className="text-xs text-slate-500">Status: {apiStatus.state === 'ok' ? `ok · última leitura ${apiStatus.at}` : apiStatus.state === 'error' ? `erro · ${apiStatus.message}` : apiStatus.state}</span>}
              </div>
            </div>
          )}

          {tab === 'mapa' && (
            <div className="space-y-3">
              <p className="text-xs text-slate-500">
                <b>flows</b>: listas que passam por etapas (campo <code>stageField</code>) viram ruas, uma etapa por prédio. <b>stocks</b>: listas com quantidade (<code>qtyField</code>) viram armazéns.
                <b> kpis</b>: <code>count</code>, <code>sum</code>, <code>avg</code> ou <code>ratio</code> com filtro <code>where</code>. Modelos: caixa, pessoa, documento, veiculo.
              </p>
              <textarea value={mappingText} onChange={(e) => setDraft(e.target.value)} spellCheck={false} className="h-80 w-full rounded-xl border border-slate-200 bg-slate-900 p-3 font-mono text-[12px] leading-relaxed text-slate-100 focus:outline-none" />
              <div className="flex gap-2">
                <button onClick={applyMapping} className="rounded-xl bg-blue-600 px-4 py-2 font-semibold text-white">Aplicar</button>
                <button onClick={() => setDraft(JSON.stringify(autoMapping(raw, mapping.name), null, 2))} className="rounded-xl bg-slate-100 px-4 py-2 font-semibold text-slate-700">Gerar automaticamente</button>
                <span className="self-center text-xs text-slate-400">Listas disponíveis: {Object.keys(raw).map((k) => `${k} (${raw[k].length})`).join(', ')}</span>
              </div>
            </div>
          )}
          {error && <div className="mt-4 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</div>}
        </div>
      </div>
    </div>
  )
}
