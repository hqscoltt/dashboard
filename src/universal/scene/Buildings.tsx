import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { useShallow } from 'zustand/react/shallow'
import { BOX, CARTON_STACK, CYL, ICO, PALLET, PLANE, WRAPPED_BLOCK, mat, textTexture } from '../../scene/materials'
import { FRONT, LEVELS, ROW_PITCH, SIDE, capacityOf, palletSlot, palletsPerGroup } from '../layout'
import { formatValue } from '../mapping'
import { useUniverse } from '../store'
import type { UFlow } from '../types'
import { Galpao } from './Galpao'
import { itemColor } from './itemModels'
import { Shell } from './Shell'

const EMPTY: string[] = []
/** Below this camera zoom pallets are drawn as plain blocks (level of detail). */
const LOD_ZOOM = 9
const HIDDEN = new THREE.Matrix4().makeTranslation(0, -999, 0)

function titleOf(key: string) {
  const s = useUniverse.getState()
  for (const f of s.model.flows) {
    const it = f.items.find((i) => i.key === key)
    if (it) return `${it.title} · ${f.def.label}`
  }
  return key
}

interface PalletSpot {
  x: number
  y: number
  z: number
  color: string
  wrapped: boolean
  key: string
}

/** Instanced pallets with detailed loads (carton stacks or stretch-wrapped blocks). */
function PalletSet({ spots, onPick, onHover }: { spots: PalletSpot[]; onPick: (key: string) => void; onHover: (key: string | null) => void }) {
  const n = Math.max(1, spots.length)
  const base = useRef<THREE.InstancedMesh>(null)
  const cartons = useRef<THREE.InstancedMesh>(null)
  const wraps = useRef<THREE.InstancedMesh>(null)
  const lod = useRef<'near' | 'far'>('near')
  // far away the cartons are just blocks: ~10x fewer vertices for big sites
  useFrame(({ camera }) => {
    const want = (camera as THREE.OrthographicCamera).zoom < LOD_ZOOM ? 'far' : 'near'
    if (want === lod.current || !base.current || !cartons.current || !wraps.current) return
    lod.current = want
    base.current.geometry = want === 'far' ? BOX : PALLET
    cartons.current.geometry = want === 'far' ? BOX : CARTON_STACK
    wraps.current.geometry = want === 'far' ? BOX : WRAPPED_BLOCK
  })
  const cAttr = useMemo(() => new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3), [n])
  const wAttr = useMemo(() => new THREE.InstancedBufferAttribute(new Float32Array(n * 3).fill(1), 3), [n])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const c = new THREE.Color()
    spots.forEach((p, i) => {
      base.current!.setMatrixAt(i, m.compose(new THREE.Vector3(p.x, p.y + 0.07, p.z), q, new THREE.Vector3(1.2, 0.14, 1.0)))
      const load = m.compose(new THREE.Vector3(p.x, p.y + 0.6, p.z), q, new THREE.Vector3(1.08, 0.92, 0.92)).clone()
      cartons.current!.setMatrixAt(i, p.wrapped ? HIDDEN : load)
      wraps.current!.setMatrixAt(i, p.wrapped ? load : HIDDEN)
      ;(p.wrapped ? wraps : cartons).current!.setColorAt(i, c.set(p.color))
    })
    for (const r of [base, cartons, wraps]) {
      r.current!.count = spots.length
      r.current!.instanceMatrix.needsUpdate = true
      if (r.current!.instanceColor) r.current!.instanceColor.needsUpdate = true
      r.current!.computeBoundingSphere()
    }
  }, [spots])
  const click = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6 || e.instanceId === undefined || !spots[e.instanceId]) return
    onPick(spots[e.instanceId].key)
  }
  const move = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    onHover(e.instanceId !== undefined ? spots[e.instanceId]?.key ?? null : null)
  }
  const out = () => onHover(null)
  return (
    <>
      <instancedMesh key={`a${n}`} ref={base} args={[PALLET, mat('#c9a77c'), n]} onClick={click} onPointerMove={move} onPointerOut={out} />
      <instancedMesh key={`c${n}`} ref={cartons} args={[CARTON_STACK, undefined, n]} instanceColor={cAttr} receiveShadow onClick={click} onPointerMove={move} onPointerOut={out}>
        <meshStandardMaterial roughness={0.85} flatShading />
      </instancedMesh>
      <instancedMesh key={`w${n}`} ref={wraps} args={[WRAPPED_BLOCK, undefined, n]} instanceColor={wAttr} receiveShadow onClick={click} onPointerMove={move} onPointerOut={out}>
        <meshStandardMaterial roughness={0.45} metalness={0.05} flatShading />
      </instancedMesh>
    </>
  )
}

function hoverKey(key: string | null, label: (k: string) => { label: string; sub?: string }) {
  const s = useUniverse.getState()
  if (!key) { s.setHovered(null); document.body.style.cursor = ''; return }
  const h = label(key)
  if (s.hovered?.label !== h.label) s.setHovered(h)
  document.body.style.cursor = 'pointer'
}

// ---------------------------------------------------------------------------- stage warehouses

const StagePallets = memo(function StagePallets({ id, flow }: { id: string; flow: UFlow }) {
  const keys = useUniverse(useShallow((s) => s.contents[id] ?? EMPTY))
  const bays = useUniverse((s) => s.layout.buildings[id]?.bays ?? 4)
  const cap = useUniverse((s) => { const b = s.layout.buildings[id]; return b ? capacityOf(b) : 0 })
  const spots = useMemo<PalletSpot[]>(() => {
    const c = new THREE.Color()
    const wrapped = flow.model !== 'caixa'
    // fixed racks: the first `cap` records are on the shelves, the sign shows the real total
    return keys.slice(0, cap).map((key, i) => {
      const s = palletSlot(i, bays)
      return { x: s.x, y: s.y, z: s.z, key, wrapped, color: `#${itemColor(flow.model, flow.color, key, c).getHexString()}` }
    })
  }, [keys, bays, cap, flow])
  return (
    <PalletSet
      spots={spots}
      onPick={(key) => useUniverse.getState().select({ kind: 'item', key })}
      onHover={(key) => hoverKey(key, (k) => ({ label: titleOf(k), sub: 'clique para ver detalhes' }))}
    />
  )
})

export const StageBuilding = memo(function StageBuilding({ id }: { id: string }) {
  const b = useUniverse((s) => s.layout.buildings[id])
  const flow = useUniverse((s) => s.model.flows.find((f) => f.def.id === b?.flowId))
  // real total of the stage (the racks only show what fits; records on their way are included)
  const count = useUniverse((s) => s.model.flows.find((x) => x.def.id === b?.flowId)?.items.filter((i) => i.stage === b?.stage).length ?? 0)
  const total = useUniverse((s) => {
    const f = s.model.flows.find((x) => x.def.id === b?.flowId)
    if (!f?.def.valueField) return null
    return f.items.reduce((a, i) => (i.stage === b?.stage ? a + (i.value ?? 0) : a), 0)
  })
  if (!b || !flow) return null
  const sub = `${count.toLocaleString('pt-BR')} ${count === 1 ? 'registro' : 'registros'}${total !== null ? ` · ${formatValue(total, flow.def.valueFormat ?? 'number')}` : ''}`
  return (
    <Galpao id={id} title={b.label} sub={sub}>
      <StagePallets id={id} flow={flow} />
    </Galpao>
  )
})

// ---------------------------------------------------------------------------- stock warehouses

const GROUP_COLORS = ['#c8a27a', '#3b82f6', '#d6b48a', '#0ea5e9', '#bf9a6c', '#6366f1', '#e0c49d', '#14b8a6']

const StockPallets = memo(function StockPallets({ stockId, bays }: { stockId: string; bays: number }) {
  const model = useUniverse((s) => s.model)
  const units = useUniverse((s) => s.palletUnits[stockId] ?? 1)
  const groups = useMemo(() => palletsPerGroup(model, stockId, units), [model, stockId, units])
  const spots = useMemo<PalletSpot[]>(() => {
    const out: PalletSpot[] = []
    groups.forEach((g, gi) => {
      const color = GROUP_COLORS[gi % GROUP_COLORS.length]
      const wrapped = gi % 2 === 1
      let p = 0
      for (const it of g.items) {
        for (let k = 0; k < it.pallets && p < bays * LEVELS; k++, p++) {
          const s = palletSlot(p, bays)
          out.push({ x: s.x, y: s.y, z: -(FRONT + gi * ROW_PITCH + 1), key: it.key, wrapped: wrapped || it.low, color: it.low ? '#f87171' : color })
        }
      }
    })
    return out
  }, [groups, bays])
  const labels = useMemo(() => groups.map((g) => textTexture(g.group.toUpperCase(), { fg: '#334155', w: 512, h: 96, font: '800 52px Inter, system-ui, sans-serif' })), [groups])
  useEffect(() => () => labels.forEach((t) => t.dispose()), [labels])
  const stock = model.stocks.find((s) => s.def.id === stockId)
  return (
    <>
      <PalletSet
        spots={spots}
        onPick={(key) => useUniverse.getState().select({ kind: 'stockItem', key })}
        onHover={(key) =>
          hoverKey(key, (k) => {
            const it = stock?.items.find((i) => i.key === k)
            return { label: it?.title ?? k, sub: it ? `${it.qty.toLocaleString('pt-BR')} ${stock?.def.unit ?? 'un.'} · ${it.group}` : undefined }
          })
        }
      />
      {groups.map((g, gi) => (
        <mesh key={g.group} position={[SIDE + 3.2, 0.08, -(FRONT + gi * ROW_PITCH + 1) + 1.75]} scale={[5.5, 1, 1]} geometry={PLANE} raycast={() => null}>
          <meshBasicMaterial map={labels[gi]} transparent depthWrite={false} />
        </mesh>
      ))}
    </>
  )
})

export const StockBuilding = memo(function StockBuilding({ id }: { id: string }) {
  const b = useUniverse((s) => s.layout.buildings[id])
  const stock = useUniverse((s) => s.model.stocks.find((x) => x.def.id === b?.stockId))
  if (!b || !stock) return null
  const sub = `${stock.total.toLocaleString('pt-BR')} ${stock.def.unit ?? 'unidades'} · ${stock.items.length} itens`
  return (
    <Galpao id={id} title={b.label} sub={sub}>
      <StockPallets stockId={stock.def.id} bays={b.bays} />
    </Galpao>
  )
})

// ---------------------------------------------------------------------------- headquarters

function kpiTexture(label: string, value: string, delta: string, up: boolean) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 320
  const g = c.getContext('2d')!
  const grad = g.createLinearGradient(0, 0, 0, 320)
  grad.addColorStop(0, '#0f172a')
  grad.addColorStop(1, '#1e3a8a')
  g.fillStyle = grad
  g.fillRect(0, 0, 512, 320)
  g.fillStyle = '#93c5fd'
  g.font = '700 34px Inter, system-ui, sans-serif'
  g.fillText(label.toUpperCase().slice(0, 24), 32, 70)
  g.fillStyle = '#ffffff'
  let size = 82
  g.font = `800 ${size}px Inter, system-ui, sans-serif`
  while (g.measureText(value).width > 450 && size > 30) {
    size -= 6
    g.font = `800 ${size}px Inter, system-ui, sans-serif`
  }
  g.fillText(value, 32, 180)
  g.fillStyle = up ? '#34d399' : '#fb7185'
  g.font = '700 38px Inter, system-ui, sans-serif'
  g.fillText(delta, 32, 262)
  const t = new THREE.CanvasTexture(c)
  t.colorSpace = THREE.SRGBColorSpace
  return t
}

function KpiScreen({ index, x, z }: { index: number; x: number; z: number }) {
  const kpi = useUniverse((s) => s.model.kpis[index])
  const base = useUniverse((s) => s.kpiBaseline[index] ?? 0)
  const tex = useMemo(() => {
    if (!kpi) return null
    const d = kpi.value - base
    const delta = kpi.format === 'percent' ? `${d >= 0 ? '+' : ''}${d.toFixed(1)} p.p.` : `${d >= 0 ? '+' : ''}${formatValue(d, kpi.format)}`
    return kpiTexture(kpi.label, formatValue(kpi.value, kpi.format), `${delta} no turno`, d >= 0)
  }, [kpi, base])
  useEffect(() => () => tex?.dispose(), [tex])
  if (!tex) return null
  return (
    <group position={[x, 3.4, z]}>
      <mesh scale={[3.5, 2.3, 0.15]} geometry={BOX} material={mat('#0f172a')} />
      <mesh position={[0, 0, 0.09]} scale={[3.3, 2.06, 1]}>
        <planeGeometry />
        <meshBasicMaterial map={tex} toneMapped={false} />
      </mesh>
      <mesh position={[0, -1.6, 0]} scale={[0.15, 1.1, 0.15]} geometry={CYL} material={mat('#475569')} />
    </group>
  )
}

function Person({ x, z, color, rot = 0 }: { x: number; z: number; color: string; rot?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 0.75, 0]} scale={[0.45, 0.8, 0.45]} geometry={CYL} material={mat(color)} castShadow />
      <mesh position={[0, 1.38, 0]} scale={[0.4, 0.4, 0.4]} geometry={ICO} material={mat('#f2c8a0')} castShadow />
    </group>
  )
}

function Desk({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <mesh position={[0, 0.75, 0]} scale={[2, 0.08, 1]} geometry={BOX} material={mat('#e2e8f0')} castShadow />
      <mesh position={[-0.9, 0.38, 0]} scale={[0.08, 0.75, 0.9]} geometry={BOX} material={mat('#94a3b8')} />
      <mesh position={[0.9, 0.38, 0]} scale={[0.08, 0.75, 0.9]} geometry={BOX} material={mat('#94a3b8')} />
      <mesh position={[0, 1.1, -0.3]} scale={[0.9, 0.55, 0.05]} geometry={BOX} material={mat('#0f172a')} />
      <mesh position={[0, 1.1, -0.27]} scale={[0.8, 0.45, 0.02]} geometry={BOX} material={mat('#3b82f6', { emissive: '#3b82f6', ei: 0.6 })} />
    </group>
  )
}

export const HQBuilding = memo(function HQBuilding() {
  const b = useUniverse((s) => s.layout.buildings.hq)
  const name = useUniverse((s) => s.mapping.name)
  const kpiCount = useUniverse((s) => s.model.kpis.length)
  if (!b) return null
  const screens = Math.min(4, kpiCount)
  const span = b.w - 3
  return (
    <Shell id="hq" title={b.label} sub={`${name} · indicadores ao vivo`} windows>
      {Array.from({ length: screens }, (_, i) => (
        <KpiScreen key={i} index={i} x={1.5 + (span / screens) * (i + 0.5)} z={-b.d + 0.5} />
      ))}
      <Desk x={4} z={-5} /><Desk x={8} z={-5} /><Desk x={12} z={-5} />
      <Desk x={4} z={-8} /><Desk x={12} z={-8} />
      <Person x={4} z={-4.1} color="#2563eb" rot={Math.PI} />
      <Person x={12} z={-4.1} color="#0891b2" rot={Math.PI} />
      <Person x={8} z={-7.1} color="#7c3aed" rot={Math.PI} />
      <Person x={10} z={-2.6} color="#334155" />
      <mesh position={[3, 0.5, -2]} scale={[1.2, 1, 1.2]} geometry={CYL} material={mat('#86c0a6')} />
    </Shell>
  )
})
