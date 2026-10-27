// EXAMPLE — how to back Trycol with a real API instead of the mock.
// 1. Implement the same LogisticsDataSource interface against your backend.
// 2. In src/simulation/engine.ts, swap `source = mockDataSource` for `source = apiDataSource`.
import type { DataEvent, InitialState, LogisticsDataSource } from './dataSource'
import { WAREHOUSES } from './mockData'

const API = import.meta.env.VITE_API_URL ?? 'https://api.example.com'
const queue: DataEvent[] = []
let socket: WebSocket | null = null

export const apiDataSource: LogisticsDataSource = {
  listWarehouses: () => WAREHOUSES, // or fetch once at startup and cache

  async load(warehouseId) {
    // Expected payload: { warehouse, slots, forklifts, trucks } — same shape as InitialState.
    const res = await fetch(`${API}/warehouses/${warehouseId}/snapshot`)
    if (!res.ok) throw new Error(`snapshot failed: ${res.status}`)
    const data = (await res.json()) as InitialState

    // Live events (new truck appointments, etc.) are buffered and handed to the engine each tick.
    socket?.close()
    socket = new WebSocket(`${API.replace(/^http/, 'ws')}/warehouses/${warehouseId}/events`)
    socket.onmessage = (msg) => queue.push(JSON.parse(msg.data) as DataEvent)
    return data
  },

  poll() {
    return queue.splice(0, queue.length)
  },

  createPallet({ responsible, lot }) {
    // In production the WMS assigns the pallet id; this placeholder keeps the UI responsive
    // until the confirmed record arrives through the event stream.
    return { id: `PLT-${Date.now() % 100000}`, sku: '—', product: 'Recebimento', qty: 0, lot, receivedAt: new Date().toLocaleDateString('pt-BR'), responsible, color: '#d6b48a' }
  },
}
