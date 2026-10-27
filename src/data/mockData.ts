// Fictitious reference data. Every name, plate and company here is made up.
import type { Product, Warehouse } from './types'

export const WAREHOUSES: Warehouse[] = [
  { id: 'riverside', name: 'Riverside Hub', city: 'Joinville, SC', fillRatio: 0.78, seed: 42, onTimeBase: { onTime: 113, total: 120 },
    theme: { accent: '#2563eb', ground: '#d5e3dc', yard: '#c3ccd6', trees: ['#6fae96', '#86c0a6', '#5d9b86'] } },
  { id: 'harbor', name: 'Harbor Point DC', city: 'Itajaí, SC', fillRatio: 0.55, seed: 7, onTimeBase: { onTime: 84, total: 92 },
    theme: { accent: '#0d9488', ground: '#e8dfca', yard: '#cfd3d6', trees: ['#4fa38a', '#7cc4a4', '#3f8f7a'] } },
  { id: 'northgate', name: 'Northgate Depot', city: 'Curitiba, PR', fillRatio: 0.9, seed: 1234, onTimeBase: { onTime: 231, total: 240 },
    theme: { accent: '#6d28d9', ground: '#e9eef4', yard: '#b9c2cc', trees: ['#4a7468', '#5f8a7c', '#3c6359'] } },
]

export const PRODUCTS: Product[] = [
  { sku: 'SKU-10432', name: 'Café torrado 500g (cx 20)', color: '#c8a27a' },
  { sku: 'SKU-20871', name: 'Detergente neutro 500ml (cx 24)', color: '#d6b48a' },
  { sku: 'SKU-31109', name: 'Arroz tipo 1 5kg (fardo 6)', color: '#e0c49d' },
  { sku: 'SKU-44210', name: 'Água mineral 1,5L (fardo 6)', color: '#7fb3e6' },
  { sku: 'SKU-50388', name: 'Papel toalha (fardo 12)', color: '#f1f5f9' },
  { sku: 'SKU-61902', name: 'Ração canina 15kg', color: '#b98c5e' },
  { sku: 'SKU-72045', name: 'Fone Bluetooth X2 (cx 40)', color: '#3b82f6' },
  { sku: 'SKU-80117', name: 'Azeite extra virgem 500ml (cx 12)', color: '#cfae7f' },
  { sku: 'SKU-91543', name: 'Lâmpada LED 9W (cx 100)', color: '#93c5fd' },
  { sku: 'SKU-11876', name: 'Cerveja lata 350ml (pack 12)', color: '#bf9a6c' },
]

export const CARRIERS = ['TransLog Sul', 'Rápido Azul Cargas', 'Via Costa Transportes', 'Expresso Serra Verde', 'NorteFrete', 'Atlântica Log']

export const DRIVERS = [
  'Carlos Menezes', 'João Batista', 'Luana Prado', 'Rafael Toledo', 'Sérgio Almeida',
  'Patrícia Lima', 'Diego Fontes', 'Marcos Vinícius', 'Elaine Ramos', 'Paulo Henrique',
  'Tiago Moura', 'Renata Dias', 'André Kowalski', 'Bruno Teixeira',
]

export const OPERATORS = ['Fernanda Rocha', 'Lucas Martins', 'Juliana Alves', 'Pedro Henrique', 'Camila Souza', 'Gustavo Reis']

export const RESPONSIBLES = ['Fernanda Rocha', 'Lucas Martins', 'Juliana Alves', 'Pedro Henrique', 'Marina Costa', 'Ricardo Nunes']

export const CITIES = [
  'São Paulo, SP', 'Curitiba, PR', 'Porto Alegre, RS', 'Florianópolis, SC', 'Blumenau, SC',
  'Campinas, SP', 'Londrina, PR', 'Chapecó, SC', 'Santos, SP', 'Maringá, PR',
]

export const FORKLIFT_MODELS = ['Toyota 8FBE20', 'Linde E20', 'Hyster J2.0XN', 'Still RX20']

export const CURRENT_USER = { name: 'Marina Costa', role: 'Gerente de Pátio', initials: 'MC' }

/** Sim clock origin: 1 simulated second = 1 clock minute. */
export const SIM_START = new Date(2026, 9, 11, 7, 30, 0)

/** Deterministic PRNG so every load of a warehouse looks the same. */
export function createRng(seed: number) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  return {
    next,
    int: (min: number, max: number) => Math.floor(next() * (max - min + 1)) + min,
    pick: <T,>(arr: readonly T[]): T => arr[Math.floor(next() * arr.length)],
    chance: (p: number) => next() < p,
  }
}
export type Rng = ReturnType<typeof createRng>

export function makePlate(rng: Rng) {
  const L = 'ABCDEFGHJKLMNPRSTUVWXYZ'
  return `${rng.pick([...L])}${rng.pick([...L])}${rng.pick([...L])}-${rng.int(0, 9)}${rng.pick([...L])}${rng.int(10, 99)}`
}

export function formatDate(d: Date) {
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatClock(d: Date) {
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}
