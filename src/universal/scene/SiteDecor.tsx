// Fills the generated site so it never looks empty: cross streets linking every row, gate
// booths at the entrances, scenery between warehouses (containers, pallet yards, sheds,
// trees) and truck parking lots with parked trailers at the end of shorter streets.
import { memo, useMemo } from 'react'
import { Car, Container, Lawn, ParkedTrailer, ParkingStripes, PalletStack } from '../../scene/Decor'
import { BOX, PLANE, mat, nightGlow } from '../../scene/materials'
import { B } from '../../scene/Part'
import type { BLayout, Layout } from '../layout'

type Rect = Pick<BLayout, 'id' | 'kind' | 'x' | 'z' | 'w' | 'd' | 'roadZ'>

function hash(n: number) {
  const x = Math.sin(n * 127.1) * 43758.5453
  return x - Math.floor(x)
}

function GateBooth({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x, 0, z]}>
      <B p={[0, 1.3, 0]} s={[2.4, 2.6, 2.2]} c="#f8fafc" outline={false} />
      <B p={[0, 2.75, 0]} s={[2.8, 0.3, 2.6]} c="#2563eb" outline={false} />
      <mesh position={[1.22, 1.6, 0]} scale={[0.05, 0.9, 1.5]} geometry={BOX} material={nightGlow.window} />
      <B p={[1.6, 0.6, 1.6]} s={[0.35, 1.2, 0.35]} c="#475569" outline={false} />
      {/* barrier arm, raised */}
      <mesh position={[1.6, 2.6, 1.6]} rotation={[0, 0, Math.PI / 2.4]} scale={[3.6, 0.12, 0.12]} geometry={BOX} material={mat('#ef4444')} />
    </group>
  )
}

function Shed({ x, z, color }: { x: number; z: number; color: string }) {
  return (
    <group position={[x, 0, z]}>
      <B p={[0, 1.4, 0]} s={[3.4, 2.8, 3]} c="#e2e8f0" outline={false} />
      <B p={[0, 2.95, 0]} s={[3.8, 0.3, 3.4]} c={color} outline={false} />
      <mesh position={[0, 1.1, 1.52]} scale={[1.4, 2.2, 0.05]} geometry={BOX} material={mat('#94a3b8')} />
    </group>
  )
}

function Bush({ x, z, k = 1 }: { x: number; z: number; k?: number }) {
  return (
    <mesh position={[x, 0.5 * k, z]} scale={[1.4 * k, 1 * k, 1.4 * k]} castShadow>
      <icosahedronGeometry args={[0.6, 0]} />
      <meshStandardMaterial color="#6fae96" flatShading roughness={0.9} />
    </mesh>
  )
}

/** Something different in each gap between two warehouses (beside them, never on the dock apron). */
function GapFiller({ x, z, depth, seed }: { x: number; z: number; depth: number; seed: number }) {
  const kind = Math.floor(hash(seed) * 4)
  const back = z - Math.min(depth - 2, 9)
  switch (kind) {
    case 0:
      return (
        <group>
          <Container x={x} z={z - 4} rot={Math.PI / 2} color={hash(seed + 1) > 0.5 ? '#0d9488' : '#2563eb'} />
          {depth > 12 && <Container x={x} z={z - 10.5} rot={Math.PI / 2} color="#ea580c" />}
        </group>
      )
    case 1:
      return (
        <group>
          <PalletStack x={x - 0.8} z={z - 2.5} layers={2} />
          <PalletStack x={x + 0.8} z={z - 2.5} wrapped color="#3b82f6" />
          <PalletStack x={x - 0.8} z={z - 4.2} />
          <PalletStack x={x + 0.8} z={z - 4.2} layers={2} color="#d6b48a" />
          <Bush x={x} z={back} />
        </group>
      )
    case 2:
      return (
        <group>
          <Shed x={x} z={z - 3.5} color={hash(seed + 2) > 0.5 ? '#2563eb' : '#0891b2'} />
          <Bush x={x - 1.2} z={back} k={1.2} />
          <Bush x={x + 1.4} z={back + 1.5} />
        </group>
      )
    default:
      return (
        <group>
          <Lawn x={x} z={z - depth / 2} w={6} d={Math.max(4, depth - 2)} />
          <Bush x={x - 1.5} z={z - 2.5} k={1.3} />
          <Bush x={x + 1.2} z={z - 5} k={1.1} />
          <Bush x={x - 0.5} z={back} k={1.4} />
        </group>
      )
  }
}

/** Truck/trailer parking lot filling the empty end of a street. */
function TruckLot({ x0, x1, z }: { x0: number; x1: number; z: number }) {
  const pitch = 4.6
  const n = Math.floor((x1 - x0) / pitch)
  if (n < 2) return null
  return (
    <group>
      <mesh position={[(x0 + x1) / 2, 0.011, z - 5.5]} scale={[x1 - x0, 1, 12]} geometry={PLANE} material={mat('#b8c2cd', { rough: 1 })} receiveShadow />
      <ParkingStripes x={x0 + 0.2} z={z - 5.5} count={n} pitch={pitch} depth={10.5} />
      {Array.from({ length: n }, (_, i) =>
        hash(i + x0) > 0.35 ? (
          <ParkedTrailer key={i} x={x0 + 0.2 + pitch * (i + 0.5)} z={z - 5.5} stripe={['#2563eb', '#0ea5e9', '#1e40af', '#64748b'][i % 4]} />
        ) : hash(i * 3 + x0) > 0.6 ? (
          <Car key={i} x={x0 + 0.2 + pitch * (i + 0.5)} z={z - 3} color="#e2e8f0" />
        ) : null,
      )}
    </group>
  )
}

export const SiteDecor = memo(function SiteDecor({ rects, roads, bounds }: { rects: Rect[]; roads: Layout['roads']; bounds: Layout['bounds'] }) {
  const rows = useMemo(() => {
    const byRoad = new Map<number, Rect[]>()
    for (const r of rects) {
      if (r.kind === 'hq') continue
      const list = byRoad.get(r.roadZ) ?? []
      list.push(r)
      byRoad.set(r.roadZ, list)
    }
    return [...byRoad.entries()].map(([roadZ, list]) => ({ roadZ, list: list.sort((a, b) => a.x - b.x) }))
  }, [rects])

  const xr = bounds.maxX - 14 // right cross street
  const zTop = Math.min(...roads.map((r) => r.z))
  const zBot = Math.max(...roads.map((r) => r.z))

  return (
    <group>
      {/* cross streets joining every row (left and right ends) */}
      {[-15, xr].map((x) => (
        <group key={x}>
          <mesh position={[x, 0.013, (zTop + zBot) / 2]} scale={[6, 1, zBot - zTop + 6]} geometry={PLANE} material={mat('#6c7784', { rough: 1 })} receiveShadow />
          <mesh position={[x - 2.85, 0.021, (zTop + zBot) / 2]} scale={[0.12, 1, zBot - zTop]} geometry={PLANE} material={mat('#e2e8f0')} />
          <mesh position={[x + 2.85, 0.021, (zTop + zBot) / 2]} scale={[0.12, 1, zBot - zTop]} geometry={PLANE} material={mat('#e2e8f0')} />
          {roads.map((r) => [-4.2, 4.2].map((dz) => (
            <group key={`${r.id}${dz}`}>
              {[-2, -1, 0, 1, 2].map((k) => (
                <mesh key={k} position={[x + k * 1.05, 0.024, r.z + dz]} scale={[0.6, 1, 1.6]} geometry={PLANE} material={mat('#f8fafc')} />
              ))}
            </group>
          )))}
        </group>
      ))}
      {roads.map((r) => <GateBooth key={r.id} x={bounds.minX + 6} z={r.z - 5} />)}

      {rows.map(({ roadZ, list }) => {
        const last = list[list.length - 1]
        const front = list[0].z
        const depth = Math.min(...list.map((b) => b.d))
        return (
          <group key={roadZ}>
            {list.slice(0, -1).map((a, i) => {
              const b = list[i + 1]
              const gap = b.x - (a.x + a.w)
              return gap > 6 ? <GapFiller key={a.id} x={a.x + a.w + gap / 2} z={front} depth={depth} seed={Math.round(a.x * 7 + roadZ)} /> : null
            })}
            {last && <TruckLot x0={last.x + last.w + 8} x1={xr - 6} z={front} />}
          </group>
        )
      })}
    </group>
  )
})
