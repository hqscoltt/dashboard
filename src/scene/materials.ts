// Shared geometries/materials so hundreds of meshes reuse a handful of GPU resources.
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

export const BOX = new THREE.BoxGeometry(1, 1, 1)
export const CYL = new THREE.CylinderGeometry(0.5, 0.5, 1, 16)
export const CYL_LOW = new THREE.CylinderGeometry(0.5, 0.5, 1, 8)
export const WHEEL = new THREE.CylinderGeometry(0.5, 0.5, 1, 14).rotateZ(Math.PI / 2)
export const CONE = new THREE.ConeGeometry(0.5, 1, 7)
export const ICO = new THREE.IcosahedronGeometry(0.5, 0)
export const PLANE = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)

const cache = new Map<string, THREE.Material>()

export function mat(color: string, opts: { rough?: number; metal?: number; emissive?: string; ei?: number } = {}) {
  const key = `${color}|${opts.rough ?? 0.8}|${opts.metal ?? 0}|${opts.emissive ?? ''}|${opts.ei ?? 0}`
  let m = cache.get(key)
  if (!m) {
    m = new THREE.MeshStandardMaterial({
      color,
      roughness: opts.rough ?? 0.8,
      metalness: opts.metal ?? 0,
      emissive: opts.emissive ?? '#000000',
      emissiveIntensity: opts.ei ?? 0,
      flatShading: true,
    })
    cache.set(key, m)
  }
  return m
}

/** Materials that glow at night (windows, lamps). Lighting updates their emissiveIntensity. */
export const nightGlow = {
  window: new THREE.MeshStandardMaterial({ color: '#9cc3ea', roughness: 0.25, metalness: 0.3, emissive: '#ffd58a', emissiveIntensity: 0 }),
  lamp: new THREE.MeshStandardMaterial({ color: '#f8fafc', emissive: '#fff2c4', emissiveIntensity: 0.2 }),
  headlight: new THREE.MeshStandardMaterial({ color: '#f8fafc', emissive: '#fff7da', emissiveIntensity: 0.3 }),
}

/** Materials recolored when the selected warehouse changes (see ThemeSync in Scene.tsx). */
export const themeMats = {
  trim: new THREE.MeshStandardMaterial({ color: '#2563eb', roughness: 0.8, flatShading: true }),
  ground: new THREE.MeshStandardMaterial({ color: '#d5e3dc', roughness: 1, flatShading: true }),
  yard: new THREE.MeshStandardMaterial({ color: '#c3ccd6', roughness: 1, flatShading: true }),
}

export const PALETTE = {
  ground: '#d5e3dc',
  concrete: '#dfe5ec',
  yard: '#c3ccd6',
  road: '#6c7784',
  floor: '#e9eef3',
  wall: '#f8fafc',
  trim: '#2563eb',
  steel: '#94a3b8',
  darkSteel: '#475569',
  yellow: '#facc15',
  white: '#ffffff',
  tire: '#1f2937',
  glass: '#1e3a5f',
  wood: '#d2b48c',
  rackUpright: '#2563eb',
  rackBeam: '#fb923c',
  forklift: '#f59e0b',
}

/** Renders text into a canvas texture — used for bay signs and floor labels (no font files needed). */
export function textTexture(text: string, opts: { bg?: string; fg?: string; w?: number; h?: number; font?: string } = {}) {
  const w = opts.w ?? 256
  const h = opts.h ?? 96
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')!
  if (opts.bg) {
    ctx.fillStyle = opts.bg
    ctx.beginPath()
    ctx.roundRect(0, 0, w, h, 14)
    ctx.fill()
  }
  ctx.fillStyle = opts.fg ?? '#fff'
  ctx.font = opts.font ?? `700 ${Math.round(h * 0.55)}px Inter, system-ui, sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, w / 2, h / 2 + 2)
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

// ---------------------------------------------------------------------------
// Detailed pallet loads (one merged geometry each, so they stay instanceable).
// Unit-sized: drawn with the same scale as the old single box (≈1.08 × h × 0.92).
// ---------------------------------------------------------------------------

function boxAt(w: number, h: number, d: number, x: number, y: number, z: number) {
  return new THREE.BoxGeometry(w, h, d).translate(x, y, z)
}

/** Six cartons (2×2 bottom + 2 on top) with tape strips, centered in a 1×1×1 cell. */
export const CARTON_STACK = (() => {
  const parts: THREE.BufferGeometry[] = []
  const g = 0.03
  const cw = 0.5 - g
  for (const x of [-0.25, 0.25]) for (const z of [-0.25, 0.25]) {
    parts.push(boxAt(cw, 0.5 - g, cw, x, -0.25, z))
    parts.push(boxAt(cw + 0.004, 0.02, 0.08, x, 0.0 - g / 2, z)) // tape
  }
  for (const z of [-0.25, 0.25]) {
    parts.push(boxAt(0.62, 0.46, cw, -0.1, 0.24, z))
    parts.push(boxAt(0.08, 0.02, cw + 0.004, -0.1, 0.47, z))
  }
  return mergeGeometries(parts.map((p) => p.toNonIndexed()))!
})()

/** Stretch-wrapped block with a few horizontal wrap bands (used for blue goods). */
export const WRAPPED_BLOCK = (() => {
  const parts: THREE.BufferGeometry[] = [boxAt(0.96, 0.96, 0.96, 0, 0, 0)]
  for (const y of [-0.3, 0, 0.3]) parts.push(boxAt(1, 0.05, 1, 0, y, 0))
  for (const x of [-0.24, 0.24]) parts.push(boxAt(0.46, 0.06, 0.46, x, 0.5, 0))
  return mergeGeometries(parts.map((p) => p.toNonIndexed()))!
})()

/** Wooden pallet: deck boards + three runners, unit-sized (1 × 1 × 1 cell, flat). */
export const PALLET = (() => {
  const parts: THREE.BufferGeometry[] = []
  for (const x of [-0.4, -0.2, 0, 0.2, 0.4]) parts.push(boxAt(0.16, 0.25, 1, x, 0.38, 0))
  for (const z of [-0.42, 0, 0.42]) parts.push(boxAt(1, 0.5, 0.16, 0, -0.1, z))
  for (const x of [-0.4, 0, 0.4]) parts.push(boxAt(0.16, 0.2, 1, x, -0.4, 0))
  return mergeGeometries(parts.map((p) => p.toNonIndexed()))!
})()
