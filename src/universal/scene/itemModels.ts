// Low-poly record models built from primitives. 'item' parts take the record's color.
import * as THREE from 'three'
import { BOX, CYL, ICO } from '../../scene/materials'
import type { ItemModel } from '../types'

export interface Part {
  geo: THREE.BufferGeometry
  pos: [number, number, number]
  scale: [number, number, number]
  color: 'item' | string
}

export const MODEL_PARTS: Record<ItemModel, Part[]> = {
  caixa: [
    { geo: BOX, pos: [0, 0.38, 0], scale: [0.95, 0.72, 0.95], color: 'item' },
    { geo: BOX, pos: [0, 0.75, 0], scale: [0.98, 0.04, 0.22], color: '#f8fafc' },
  ],
  pessoa: [
    { geo: CYL, pos: [0, 0.5, 0], scale: [0.5, 0.95, 0.5], color: 'item' },
    { geo: ICO, pos: [0, 1.18, 0], scale: [0.44, 0.44, 0.44], color: '#f2c8a0' },
  ],
  documento: [
    { geo: BOX, pos: [0, 0.12, 0], scale: [0.85, 0.22, 1.05], color: '#ffffff' },
    { geo: BOX, pos: [0, 0.24, -0.33], scale: [0.86, 0.03, 0.3], color: 'item' },
  ],
  veiculo: [
    { geo: BOX, pos: [0, 0.38, 0], scale: [0.95, 0.5, 1.55], color: 'item' },
    { geo: BOX, pos: [0, 0.8, -0.12], scale: [0.82, 0.36, 0.8], color: '#dbeafe' },
  ],
}

export function hash(s: string) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619)
  return (h >>> 0) / 4294967295
}

const CARDBOARD = ['#d6b48a', '#c8a27a', '#e0c49d', '#cfae7f', '#bf9a6c']
const tmp = new THREE.Color()

/** Record color: cardboard tones for boxes, flow color with slight variation otherwise. */
export function itemColor(model: ItemModel, flowColor: string, key: string, out = new THREE.Color()) {
  const h = hash(key)
  if (model === 'caixa') return out.set(CARDBOARD[Math.floor(h * CARDBOARD.length)])
  tmp.set(flowColor)
  const hsl = { h: 0, s: 0, l: 0 }
  tmp.getHSL(hsl)
  return out.setHSL((hsl.h + (h - 0.5) * 0.08 + 1) % 1, Math.min(1, hsl.s * (0.75 + h * 0.3)), Math.min(0.75, hsl.l * (0.85 + h * 0.4)))
}
