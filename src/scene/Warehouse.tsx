import { memo, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import {
  BAY_NAMES, BAY_X, DOOR_HALF_WIDTH, DOOR_HEIGHT, FORKLIFT_HOMES, RACK_BAY_XS, RACK_DEPTH, RACK_ROWS, WAREHOUSE,
} from '../data/layout'
import { WAREHOUSES } from '../data/mockData'
import { engine } from '../simulation/engine'
import { useSim } from '../store/useSimStore'
import { BOX, CYL, PALETTE, PLANE, mat, nightGlow, textTexture, themeMats } from './materials'
import { B } from './Part'
import { Selectable } from './Selectable'

const { minX, maxX, minZ, maxZ, height: H } = WAREHOUSE
const W = maxX - minX
const D = maxZ - minZ
const LOW = 1.4 // cut-away wall height on the camera-facing sides

function useAccent() {
  const id = useSim((s) => s.warehouseId)
  return (WAREHOUSES.find((w) => w.id === id) ?? WAREHOUSES[0]).theme.accent
}

const STATUS_COLOR = { livre: '#22c55e', reservada: '#f59e0b', ocupada: '#ef4444' }

function Dock({ index }: { index: number }) {
  const bx = BAY_X[index]
  const panel = useRef<THREE.Mesh>(null)
  const drum = useRef<THREE.Mesh>(null)
  const lightMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#22c55e', emissive: '#22c55e', emissiveIntensity: 1.2 }), [])
  const accent = useAccent()
  const sign = useMemo(() => textTexture(BAY_NAMES[index].toUpperCase(), { bg: accent, fg: '#ffffff', w: 256, h: 96 }), [index, accent])

  useFrame(() => {
    const d = engine.docks[index]
    if (!d || !panel.current) return
    const h = Math.max(0.18, DOOR_HEIGHT * (1 - d.door))
    panel.current.scale.y = h
    panel.current.position.y = DOOR_HEIGHT - h / 2
    const c = STATUS_COLOR[d.v.status]
    lightMat.color.set(c)
    lightMat.emissive.set(c)
  })

  const fw = DOOR_HALF_WIDTH
  return (
    <Selectable kind="dock" id={`DOCK-${index + 1}`} label={BAY_NAMES[index]}>
      <group position={[bx, 0, maxZ]}>
        {/* frame + dark rubber seals */}
        {/* sizes are staggered by a few cm on purpose: coplanar faces z-fight (flicker) when zooming */}
        <B p={[-fw - 0.25, (DOOR_HEIGHT + 0.5) / 2, 0]} s={[0.46, DOOR_HEIGHT + 0.5, 0.46]} c={PALETTE.wall} />
        <B p={[fw + 0.25, (DOOR_HEIGHT + 0.5) / 2, 0]} s={[0.46, DOOR_HEIGHT + 0.5, 0.46]} c={PALETTE.wall} />
        <B p={[0, DOOR_HEIGHT + 0.35, 0]} s={[fw * 2 + 1.06, 0.5, 0.54]} c="" material={themeMats.trim} />
        <B p={[-fw + 0.05, DOOR_HEIGHT / 2, 0.3]} s={[0.22, DOOR_HEIGHT, 0.25]} c="#334155" />
        <B p={[fw - 0.05, DOOR_HEIGHT / 2, 0.3]} s={[0.22, DOOR_HEIGHT, 0.25]} c="#334155" />
        {/* roll-up door */}
        <mesh ref={panel} position={[0, DOOR_HEIGHT / 2, 0.02]} scale={[fw * 2 - 0.1, DOOR_HEIGHT, 0.1]} geometry={BOX} material={mat('#e2e8f0', { rough: 0.6 })} castShadow />
        <mesh ref={drum} position={[0, DOOR_HEIGHT - 0.1, -0.15]} rotation={[0, 0, Math.PI / 2]} scale={[0.4, fw * 2, 0.4]} geometry={CYL} material={mat(PALETTE.darkSteel)} />
        {/* bumpers & leveler */}
        <B p={[-1.25, 1.05, 0.35]} s={[0.35, 0.5, 0.3]} c="#111827" />
        <B p={[1.25, 1.05, 0.35]} s={[0.35, 0.5, 0.3]} c="#111827" />
        <B p={[0, 0.04, -0.9]} s={[fw * 2 - 0.4, 0.08, 1.6]} c="#9ca3af" receive />
        <B p={[0, 0.05, -1.72]} s={[fw * 2 - 0.4, 0.09, 0.14]} c={PALETTE.yellow} outline={false} />
        {/* sign + status light */}
        <mesh position={[0, DOOR_HEIGHT + 1.15, 0.27]} rotation={[0, 0, 0]} scale={[2.6, 0.95, 1]}>
          <planeGeometry />
          <meshBasicMaterial map={sign} toneMapped={false} />
        </mesh>
        <B p={[0, DOOR_HEIGHT + 1.18, 0.19]} s={[2.75, 1.1, 0.1]} c="#e2e8f0" />
        <mesh position={[fw + 0.25, DOOR_HEIGHT + 0.2, 0.33]} scale={[0.32, 0.32, 0.2]} geometry={BOX} material={lightMat} />
      </group>
    </Selectable>
  )
}

function BackWallLogo() {
  const id = useSim((s) => s.warehouseId)
  const w = WAREHOUSES.find((x) => x.id === id) ?? WAREHOUSES[0]
  const tex = useMemo(() => textTexture(`Trycol · ${w.name.toUpperCase()}`, { fg: w.theme.accent, w: 1024, h: 96, font: '800 54px Inter, system-ui, sans-serif' }), [w])
  return (
    <mesh position={[0, 6.2, minZ + 0.22]} scale={[24, 2.25, 1]}>
      <planeGeometry />
      <meshBasicMaterial map={tex} transparent toneMapped={false} />
    </mesh>
  )
}

function FloorMarkings() {
  const lines: [number, number, number, number][] = [] // x, z, w, d
  for (const row of RACK_ROWS) {
    const zf = row.z + RACK_DEPTH / 2 + 0.35
    lines.push([-10, zf, 16.6, 0.12], [10, zf, 16.6, 0.12])
  }
  lines.push([-2, maxZ - 3.4, 40, 0.14])
  return (
    <>
      {lines.map(([x, z, w, d], i) => (
        <mesh key={i} position={[x, 0.065, z]} scale={[w, 1, d]} geometry={PLANE} material={mat(PALETTE.yellow, { rough: 1 })} />
      ))}
      {FORKLIFT_HOMES.map((h, i) => (
        <group key={i}>
          <mesh position={[h.x, 0.062, h.z]} scale={[3, 1, 2.2]} geometry={PLANE} material={mat('#bfdbfe', { rough: 1 })} receiveShadow />
          <B p={[maxX - 0.6, 0.8, h.z]} s={[0.5, 1.6, 0.8]} c="#e2e8f0" />
          <mesh position={[maxX - 0.88, 1.25, h.z]} scale={[0.06, 0.3, 0.4]} geometry={BOX} material={mat('#22c55e', { emissive: '#22c55e', ei: 0.9 })} />
        </group>
      ))}
    </>
  )
}

function Decor() {
  // stacks of empty pallets and stretch-wrapped staged loads near the docks
  const stacks: [number, number, number][] = [[-22.4, -3.2, 5], [-21, -3.2, 3], [-22.4, -4.5, 4]]
  return (
    <>
      {stacks.map(([x, z, n], i) =>
        [...Array(n)].map((_, k) => <B key={`${i}-${k}`} p={[x, 0.1 + k * 0.17, z]} s={[1.2, 0.14, 1]} c={PALETTE.wood} outline={false} />),
      )}
    </>
  )
}

export const Warehouse = memo(function Warehouse() {
  const trussXs = useMemo(() => [-24, -16, -8, 0, 8, 16, 24], [])
  const lowSegments = useMemo(() => {
    const edges = [minX, ...BAY_X.flatMap((x) => [x - DOOR_HALF_WIDTH - 0.5, x + DOOR_HALF_WIDTH + 0.5]), maxX]
    const segs: [number, number][] = []
    for (let i = 0; i < edges.length; i += 2) segs.push([edges[i], edges[i + 1]])
    return segs
  }, [])

  return (
    <group>
      {/* slab */}
      <B p={[0, 0.03, (minZ + maxZ) / 2]} s={[W, 0.06, D]} c={PALETTE.floor} receive shadow={false} outline={false} />
      {/* back + left full-height walls */}
      <B p={[0, H / 2, minZ]} s={[W + 0.38, H, 0.4]} c={PALETTE.wall} receive outline={false} />
      <B p={[minX, H / 2, (minZ + maxZ) / 2]} s={[0.4, H, D]} c={PALETTE.wall} receive outline={false} />
      <B p={[0, H - 0.38, minZ + 0.01]} s={[W + 0.46, 0.8, 0.44]} c="" material={themeMats.trim} outline={false} />
      <B p={[minX + 0.01, H - 0.385, (minZ + maxZ) / 2]} s={[0.44, 0.79, D]} c="" material={themeMats.trim} outline={false} />
      <B p={[0, 0.5, minZ + 0.01]} s={[W + 0.44, 1, 0.44]} c="#cbd5e1" outline={false} />
      {/* 4 windows evenly spread along the left wall (z from minZ to maxZ) */}
      {[0, 1, 2, 3].map((i) => (
        <mesh key={i} position={[minX + 0.22, 5.3, minZ + (D / 4) * (i + 0.5)]} scale={[0.05, 1.2, D / 4 - 1.6]} geometry={BOX} material={nightGlow.window} />
      ))}
      <BackWallLogo />

      {/* cut-away low walls on the camera-facing sides */}
      <B p={[maxX, LOW / 2, (minZ + maxZ) / 2]} s={[0.4, LOW, D]} c={PALETTE.wall} outline={false} />
      {lowSegments.map(([a, b], i) => (
        <B key={i} p={[(a + b) / 2, (LOW + 0.03) / 2, maxZ]} s={[b - a, LOW + 0.03, 0.42]} c={PALETTE.wall} outline={false} />
      ))}
      {/* steel skeleton: corner columns, ring beams and roof trusses */}
      {[[maxX, maxZ], [maxX, minZ], [minX, maxZ]].map(([x, z], i) => (
        <B key={i} p={[x, (H + 0.05) / 2, z]} s={[0.5, H + 0.05, 0.5]} c={PALETTE.steel} outline={false} />
      ))}
      <B p={[0, H, maxZ]} s={[W, 0.3, 0.3]} c={PALETTE.steel} outline={false} />
      <B p={[maxX, H, (minZ + maxZ) / 2]} s={[0.3, 0.3, D]} c={PALETTE.steel} outline={false} />
      {trussXs.map((x) => (
        <B key={x} p={[x, H + 0.1, (minZ + maxZ) / 2]} s={[0.2, 0.2, D]} c={PALETTE.steel} shadow={false} outline={false} />
      ))}

      {BAY_X.map((_, i) => <Dock key={i} index={i} />)}
      <FloorMarkings />
      <Decor />
      {/* rack end protectors */}
      {RACK_ROWS.flatMap((r) => [RACK_BAY_XS[0] - 1.25, RACK_BAY_XS[7] + 1.25, RACK_BAY_XS[8] - 1.25, RACK_BAY_XS[15] + 1.25].map((x) => (
        <B key={`${r.name}${x}`} p={[x, 0.35, r.z]} s={[0.25, 0.7, RACK_DEPTH + 0.2]} c={PALETTE.yellow} outline={false} />
      )))}
    </group>
  )
})
