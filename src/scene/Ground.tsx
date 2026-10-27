import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { BAY_X, DOCK_TRUCK_Z, DOOR_HALF_WIDTH, PARKING, ROAD, TRUCK_LENGTH, WAREHOUSE, YARD } from '../data/layout'
import { WAREHOUSES } from '../data/mockData'
import { useSim } from '../store/useSimStore'
import { BOX, CYL_LOW, ICO, PALETTE, PLANE, mat, nightGlow, textTexture, themeMats } from './materials'
import { B } from './Part'

function Flat({ x, z, w, d, y = 0.01, color, material }: { x: number; z: number; w: number; d: number; y?: number; color?: string; material?: THREE.Material }) {
  return <mesh position={[x, y, z]} scale={[w, 1, d]} geometry={PLANE} material={material ?? mat(color ?? '#fff', { rough: 1 })} receiveShadow />
}

function GroundLabel({ text, x, z, size = 2.4, color = '#ffffff' }: { text: string; x: number; z: number; size?: number; color?: string }) {
  const tex = useMemo(() => textTexture(text, { fg: color, w: 256, h: 128 }), [text, color])
  return (
    <mesh position={[x, 0.03, z]} scale={[size * 2, 1, size]} geometry={PLANE}>
      <meshBasicMaterial map={tex} transparent depthWrite={false} opacity={0.85} />
    </mesh>
  )
}

function Trees() {
  const trunks = useRef<THREE.InstancedMesh>(null)
  const crowns = useRef<THREE.InstancedMesh>(null)
  const warehouseId = useSim((s) => s.warehouseId)
  const palette = (WAREHOUSES.find((w) => w.id === warehouseId) ?? WAREHOUSES[0]).theme.trees
  const spots = useMemo(() => {
    const pts: [number, number, number][] = []
    let s = 7
    const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    for (let x = -60; x <= 50; x += 5.5) pts.push([x + rnd() * 2, -31 - rnd() * 4, 0.8 + rnd() * 0.6])
    for (let z = -26; z <= 18; z += 5) pts.push([-52 - rnd() * 3, z, 0.8 + rnd() * 0.5])
    for (let z = -26; z <= 18; z += 5.5) pts.push([47 + rnd() * 3, z, 0.8 + rnd() * 0.5])
    for (let x = -58; x <= 55; x += 7) pts.push([x + rnd() * 3, 36 + rnd() * 3, 0.9 + rnd() * 0.5])
    pts.push([-30, -5, 1], [-46, -6, 1.1], [-29, 14, 0.9], [-47, 17, 1], [43, 2, 1], [44, 19, 0.9])
    return pts
  }, [])

  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const c = new THREE.Color()
    spots.forEach(([x, z, k], i) => {
      m.compose(new THREE.Vector3(x, 0.7 * k, z), q, new THREE.Vector3(0.35 * k, 1.4 * k, 0.35 * k))
      trunks.current!.setMatrixAt(i, m)
      q.setFromEuler(new THREE.Euler(0, i * 1.3, 0))
      m.compose(new THREE.Vector3(x, 2.4 * k, z), q, new THREE.Vector3(2.6 * k, 3 * k, 2.6 * k))
      crowns.current!.setMatrixAt(i, m)
      crowns.current!.setColorAt(i, c.set(palette[i % 3]))
      q.identity()
    })
    trunks.current!.instanceMatrix.needsUpdate = true
    crowns.current!.instanceMatrix.needsUpdate = true
    if (crowns.current!.instanceColor) crowns.current!.instanceColor.needsUpdate = true
  }, [spots, palette])

  return (
    <>
      <instancedMesh ref={trunks} args={[CYL_LOW, mat('#8b6b4e'), spots.length]} castShadow />
      <instancedMesh ref={crowns} args={[ICO, undefined, spots.length]} castShadow>
        <meshStandardMaterial flatShading roughness={0.9} />
      </instancedMesh>
    </>
  )
}

function Lamps() {
  const pts: [number, number][] = [[-26, 0], [-26, 20], [20, 20], [42, 4], [42, 20], [-6, 21.5]]
  return (
    <>
      {pts.map(([x, z], i) => (
        <group key={i} position={[x, 0, z]}>
          <B p={[0, 3, 0]} s={[0.16, 6, 0.16]} c={PALETTE.darkSteel} outline={false} />
          <B p={[0.5, 6, 0]} s={[1.2, 0.12, 0.3]} c={PALETTE.darkSteel} outline={false} />
          <mesh position={[0.9, 5.9, 0]} scale={[0.5, 0.1, 0.3]} geometry={BOX} material={nightGlow.lamp} />
        </group>
      ))}
    </>
  )
}

function GateHouse() {
  return (
    <group position={[-30, 0, 23]}>
      <B p={[0, 1.3, 0]} s={[2.6, 2.6, 2.4]} c={PALETTE.wall} />
      <B p={[0, 2.75, 0]} s={[3, 0.3, 2.8]} c="" material={themeMats.trim} />
      <mesh position={[1.31, 1.6, 0]} scale={[0.05, 0.9, 1.6]} geometry={BOX} material={nightGlow.window} />
      <B p={[2.2, 0.6, 1.4]} s={[0.4, 1.2, 0.4]} c={PALETTE.darkSteel} />
    </group>
  )
}

export const Ground = memo(function Ground() {
  const dashes = useMemo(() => {
    const out: number[] = []
    for (let x = ROAD.minX; x < ROAD.maxX; x += 6) out.push(x)
    return out
  }, [])

  return (
    <group>
      {/* base terrain */}
      <mesh position={[0, -0.05, 0]} scale={[220, 0.1, 160]} geometry={BOX} material={themeMats.ground} receiveShadow />
      {/* yard concrete */}
      <Flat x={(YARD.minX + YARD.maxX) / 2} z={(YARD.minZ + YARD.maxZ) / 2 + 0.5} w={YARD.maxX - YARD.minX} d={YARD.maxZ - YARD.minZ + 1} material={themeMats.yard} />
      {/* site apron around the warehouse */}
      <Flat x={0} z={-13} w={56} d={26} y={0.008} color={PALETTE.concrete} />
      {/* road */}
      <Flat x={0} z={ROAD.z} w={ROAD.maxX - ROAD.minX} d={ROAD.halfWidth * 2} y={0.012} color={PALETTE.road} />
      <Flat x={0} z={ROAD.z - ROAD.halfWidth + 0.25} w={ROAD.maxX - ROAD.minX} d={0.15} y={0.02} color="#e2e8f0" />
      <Flat x={0} z={ROAD.z + ROAD.halfWidth - 0.25} w={ROAD.maxX - ROAD.minX} d={0.15} y={0.02} color="#e2e8f0" />
      {dashes.map((x) => <Flat key={x} x={x} z={ROAD.z} w={3} d={0.18} y={0.02} color={PALETTE.yellow} />)}
      {/* sidewalk */}
      <Flat x={0} z={ROAD.z + ROAD.halfWidth + 1} w={ROAD.maxX - ROAD.minX} d={2} y={0.015} color="#e5e7eb" />

      {/* dock lanes with yellow guide lines */}
      {BAY_X.map((bx, i) => (
        <group key={i}>
          <Flat x={bx - DOOR_HALF_WIDTH - 0.1} z={DOCK_TRUCK_Z} w={0.18} d={TRUCK_LENGTH + 1} y={0.02} color={PALETTE.yellow} />
          <Flat x={bx + DOOR_HALF_WIDTH + 0.1} z={DOCK_TRUCK_Z} w={0.18} d={TRUCK_LENGTH + 1} y={0.02} color={PALETTE.yellow} />
          <Flat x={bx} z={WAREHOUSE.maxZ + TRUCK_LENGTH + 1.3} w={DOOR_HALF_WIDTH * 2 + 0.4} d={0.25} y={0.02} color="#ffffff" />
          <GroundLabel text={`${i + 1}`} x={bx} z={WAREHOUSE.maxZ + TRUCK_LENGTH + 3} size={2.2} />
        </group>
      ))}

      {/* waiting / parking area */}
      {PARKING.map((p, i) => (
        <group key={i}>
          <Flat x={p.x - 2} z={p.z} w={0.2} d={TRUCK_LENGTH + 1} y={0.02} color={PALETTE.yellow} />
          {i === PARKING.length - 1 && <Flat x={p.x + 2} z={p.z} w={0.2} d={TRUCK_LENGTH + 1} y={0.02} color={PALETTE.yellow} />}
          <GroundLabel text={`P${i + 1}`} x={p.x} z={p.z - TRUCK_LENGTH / 2 - 1.3} size={1.4} color="#facc15" />
        </group>
      ))}
      <Flat x={PARKING[1].x} z={PARKING[0].z - TRUCK_LENGTH / 2 - 0.5} w={12.2} d={0.2} y={0.02} color={PALETTE.yellow} />
      {/* hatched no-parking zone */}
      {[0, 1, 2, 3, 4, 5].map((k) => (
        <Flat key={k} x={22 + k * 0.9} z={18} w={0.22} d={3} y={0.02} color={PALETTE.yellow} />
      ))}

      {/* pedestrian walkway */}
      <Flat x={-26.5} z={10} w={1.6} d={24} y={0.02} color="#e2e8f0" />
      {[...Array(10)].map((_, k) => <Flat key={k} x={-26.5} z={-1 + k * 2.4} w={1.6} d={0.9} y={0.025} color="#facc15" />)}

      <Trees />
      <Lamps />
      <GateHouse />
    </group>
  )
})
