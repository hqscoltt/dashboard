// Terrain and scenery of the universal site: two-lane streets (one per flow + the avenue),
// perimeter fence with gates at the streets, staff car park, lawns, trees, lamps, shipping
// containers and outdoor pallet stacks. Regenerated only when the site outline changes.
import { memo, useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { Car, Container, Fence, Lawn, ParkedTrailer, ParkingStripes, PalletStack } from '../../scene/Decor'
import { BOX, CYL_LOW, ICO, PLANE, mat, nightGlow, textTexture } from '../../scene/materials'
import { useUniverse } from '../store'
import { SiteDecor } from './SiteDecor'
import type { Layout } from '../layout'

function RoadSign({ x, z, text, color }: { x: number; z: number; text: string; color: string }) {
  const tex = useMemo(() => textTexture(`${text.toUpperCase()}  →`, { bg: color, fg: '#ffffff', w: 512, h: 112, font: '800 54px Inter, system-ui, sans-serif' }), [text, color])
  useEffect(() => () => tex.dispose(), [tex])
  return (
    <group position={[x, 0, z]}>
      <mesh position={[-2, 1.6, 0]} scale={[0.15, 3.2, 0.15]} geometry={BOX} material={mat('#475569')} />
      <mesh position={[2, 1.6, 0]} scale={[0.15, 3.2, 0.15]} geometry={BOX} material={mat('#475569')} />
      <mesh position={[0, 3.3, 0]} scale={[5, 1.1, 1]}>
        <planeGeometry />
        <meshBasicMaterial map={tex} toneMapped={false} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

function Trees({ spots }: { spots: [number, number, number][] }) {
  const trunks = useRef<THREE.InstancedMesh>(null)
  const crowns = useRef<THREE.InstancedMesh>(null)
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const c = new THREE.Color()
    const palette = ['#6fae96', '#86c0a6', '#5d9b86']
    spots.forEach(([x, z, k], i) => {
      trunks.current!.setMatrixAt(i, m.compose(new THREE.Vector3(x, 0.7 * k, z), q, new THREE.Vector3(0.35 * k, 1.4 * k, 0.35 * k)))
      crowns.current!.setMatrixAt(i, m.compose(new THREE.Vector3(x, 2.4 * k, z), q, new THREE.Vector3(2.6 * k, 3 * k, 2.6 * k)))
      crowns.current!.setColorAt(i, c.set(palette[i % 3]))
    })
    trunks.current!.count = crowns.current!.count = spots.length
    for (const r of [trunks, crowns]) {
      r.current!.instanceMatrix.needsUpdate = true
      r.current!.computeBoundingSphere()
    }
    if (crowns.current!.instanceColor) crowns.current!.instanceColor.needsUpdate = true
  }, [spots])
  return (
    <>
      <instancedMesh ref={trunks} args={[CYL_LOW, mat('#8b6b4e'), 500]} castShadow />
      <instancedMesh ref={crowns} args={[ICO, undefined, 500]} castShadow>
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
    </>
  )
}

export const UGround = memo(function UGround() {
  // only re-render when the outline changes (stringified to ignore record-level updates)
  const sig = useUniverse((s) => {
    const all = Object.values(s.layout.buildings)
    const rects = all.map((b) => ({ id: b.id, kind: b.kind, x: Math.round(b.x), z: Math.round(b.z), w: Math.round(b.w), d: Math.round(b.d), roadZ: Math.round(b.roadZ) }))
    return JSON.stringify([s.layout.bounds, s.layout.roads, s.layout.buildings.hq, all.filter((b) => b.kind === 'stock').map((b) => [b.x, b.w, b.d]), rects])
  })
  const [bounds, roads, hq, stocks, rects] = useMemo(
    () => JSON.parse(sig) as [Layout['bounds'], Layout['roads'], Layout['buildings'][string], [number, number, number][], Parameters<typeof SiteDecor>[0]['rects']],
    [sig],
  )
  const w = bounds.maxX - bounds.minX
  const d = bounds.maxZ - bounds.minZ
  const cx = (bounds.minX + bounds.maxX) / 2
  const cz = (bounds.minZ + bounds.maxZ) / 2

  const { fence, trees } = useMemo(() => {
    const f: [number, number, number, number][] = []
    const x0 = bounds.minX + 4
    const x1 = bounds.maxX - 4
    const z0 = bounds.minZ + 2
    const z1 = bounds.maxZ + 3
    f.push([x0, z0, x1, z0], [x0, z1, x1, z1])
    // side fences with gates where the streets cross them
    for (const x of [x0, x1]) {
      const gates = roads.map((r) => r.z).sort((a, b) => a - b)
      let from = z0
      for (const g of gates) {
        if (g - 3.5 > from) f.push([x, from, x, g - 3.5])
        from = g + 3.5
      }
      if (z1 > from) f.push([x, from, x, z1])
    }
    const t: [number, number, number][] = []
    let s = 3
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    for (let x = bounds.minX; x <= bounds.maxX; x += 5 + r() * 2) {
      t.push([x, z0 - 3 - r() * 3, 0.8 + r() * 0.5])
      t.push([x, z1 + 3 + r() * 3, 0.8 + r() * 0.5])
    }
    for (const rd of roads) for (let x = rd.x0 + 10; x < rd.x1 - 6; x += 11 + r() * 5) {
      if (r() < 0.55) t.push([x, rd.z + 4.4, 0.6 + r() * 0.3])
    }
    return { fence: f, trees: t.slice(0, 500) }
  }, [bounds, roads])

  const dashes = (x0: number, x1: number) => {
    const out: number[] = []
    for (let x = x0 + 2; x < x1 - 2; x += 5) out.push(x)
    return out
  }

  return (
    <group>
      <mesh position={[cx, -0.05, cz]} scale={[w + 160, 0.1, d + 120]} geometry={BOX} material={mat('#d5e3dc', { rough: 1 })} receiveShadow />
      <mesh position={[cx, 0.005, cz]} scale={[w - 6, 1, d]} geometry={PLANE} material={mat('#dfe5ec', { rough: 1 })} receiveShadow />
      {roads.map((r) => (
        <group key={r.id}>
          <mesh position={[(r.x0 + r.x1) / 2, 0.012, r.z]} scale={[r.x1 - r.x0, 1, 6]} geometry={PLANE} material={mat('#6c7784', { rough: 1 })} receiveShadow />
          <mesh position={[(r.x0 + r.x1) / 2, 0.02, r.z - 2.85]} scale={[r.x1 - r.x0, 1, 0.12]} geometry={PLANE} material={mat('#e2e8f0')} />
          <mesh position={[(r.x0 + r.x1) / 2, 0.02, r.z + 2.85]} scale={[r.x1 - r.x0, 1, 0.12]} geometry={PLANE} material={mat('#e2e8f0')} />
          {dashes(r.x0, r.x1).map((x) => (
            <mesh key={x} position={[x, 0.022, r.z]} scale={[2.4, 1, 0.16]} geometry={PLANE} material={mat('#facc15')} />
          ))}
          <Lawn x={(r.x0 + r.x1) / 2} z={r.z + 4.4} w={r.x1 - r.x0} d={2.2} />
          <RoadSign x={r.x0 + 8} z={r.z + 4.4} text={r.label} color={r.color} />
          {[r.x0 + 18, (r.x0 + r.x1) / 2, r.x1 - 12].map((x) => (
            <group key={x} position={[x, 0, r.z + 3.6]}>
              <mesh position={[0, 2.8, 0]} scale={[0.14, 5.6, 0.14]} geometry={BOX} material={mat('#475569')} />
              <mesh position={[0, 5.5, -0.6]} scale={[0.32, 0.12, 1.2]} geometry={BOX} material={nightGlow.lamp} />
            </group>
          ))}
        </group>
      ))}

      {/* staff car park next to the headquarters */}
      {hq && (
        <group>
          <mesh position={[hq.x + hq.w + 7, 0.012, -6]} scale={[12, 1, 12]} geometry={PLANE} material={mat('#b8c2cd', { rough: 1 })} receiveShadow />
          <ParkingStripes x={hq.x + hq.w + 2} z={-9} count={4} pitch={2.6} />
          <ParkingStripes x={hq.x + hq.w + 2} z={-2.6} count={4} pitch={2.6} />
          <Car x={hq.x + hq.w + 3.3} z={-9} color="#3b82f6" />
          <Car x={hq.x + hq.w + 5.9} z={-9} color="#e2e8f0" />
          <Car x={hq.x + hq.w + 11.1} z={-9} color="#64748b" />
          <Car x={hq.x + hq.w + 5.9} z={-2.6} color="#f8fafc" rot={Math.PI} />
          <Car x={hq.x + hq.w + 8.5} z={-2.6} color="#1e40af" rot={Math.PI} />
        </group>
      )}

      {/* containers and parked trailers behind the stock row */}
      {stocks.length > 0 && (
        <group>
          <Container x={stocks[0][0] + 4} z={-stocks[0][2] - 4} color="#0d9488" />
          <Container x={stocks[0][0] + 11} z={-stocks[0][2] - 4} color="#2563eb" />
          <Container x={stocks[0][0] + 4} z={-stocks[0][2] - 4} y={2.6} color="#ea580c" />
          <ParkedTrailer x={stocks[0][0] + stocks[0][1] - 4} z={-stocks[0][2] - 5} rot={Math.PI / 2} />
        </group>
      )}
      {/* outdoor pallets waiting next to the headquarters */}
      {hq && (
        <group>
          <PalletStack x={hq.x - 4} z={2} layers={2} />
          <PalletStack x={hq.x - 4} z={3.6} wrapped color="#3b82f6" />
          <PalletStack x={hq.x - 5.6} z={2} />
        </group>
      )}

      <SiteDecor rects={rects} roads={roads} bounds={bounds} />
      <Fence segments={fence} />
      <Trees spots={trees} />
    </group>
  )
})
