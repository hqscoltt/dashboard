// Trucks of the universal dashboard (simulated in fleet.ts), drawn with the logistics truck model.
import { memo, useEffect, useReducer, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { TRUCK_WIDTH } from '../../data/layout'
import { Wheel } from '../../scene/Part'
import { TruckModel, WHEEL_R } from '../../scene/Truck'
import { fleet, updateFleet, type UTruck } from '../fleet'
import { useUniverse } from '../store'

const TW = TRUCK_WIDTH

function truckLabel(t: UTruck) {
  const L = useUniverse.getState().layout
  const to = t.to ? L.buildings[t.to]?.label : null
  const from = t.from ? L.buildings[t.from]?.label : null
  const what = t.keys.length ? `${t.keys.length} registro${t.keys.length > 1 ? 's' : ''}` : 'paletes'
  const route = from && to ? `${from} → ${to}` : to ? `entrega em ${to}` : from ? `coleta em ${from}` : ''
  return { label: `Caminhão ${String(t.id).padStart(3, '0')} · ${what}`, sub: route }
}

const FleetTruck = memo(function FleetTruck({ id }: { id: number }) {
  const root = useRef<THREE.Group>(null)
  const wheels = useRef<THREE.Group>(null)
  useFrame(() => {
    const t = fleet.trucks.find((x) => x.id === id)
    if (!t || !root.current) return
    root.current.position.set(t.x, 0, t.z)
    root.current.rotation.y = t.heading
    for (const w of wheels.current!.children) w.rotation.x = t.odometer / WHEEL_R
  })
  const t = fleet.trucks.find((x) => x.id === id)
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const cur = fleet.trucks.find((x) => x.id === id)
    if (cur) useUniverse.getState().setHovered(truckLabel(cur))
    document.body.style.cursor = 'pointer'
  }
  return (
    <group
      ref={root}
      onPointerOver={onOver}
      onPointerOut={() => { useUniverse.getState().setHovered(null); document.body.style.cursor = '' }}
      onClick={(e) => {
        e.stopPropagation()
        if (e.delta <= 6) useUniverse.getState().select({ kind: 'truck', key: String(id) })
      }}
    >
      <TruckModel variant={t?.variant ?? 0} />
      <group ref={wheels}>
        {[4.1, -3.2, -4.3].flatMap((z) => [-1, 1].map((s) => <Wheel key={`${z}${s}`} p={[s * (TW / 2 - 0.2), WHEEL_R, z]} radius={WHEEL_R} width={0.42} />))}
      </group>
    </group>
  )
})

export function UTrucks() {
  const [, bump] = useReducer((x: number) => x + 1, 0)
  useEffect(() => {
    fleet.listeners.add(bump)
    return () => { fleet.listeners.delete(bump) }
  }, [])
  // advance trucks + forklifts before anything reads their positions
  useFrame((_, dt) => updateFleet(dt), -1)
  return <>{fleet.trucks.map((t) => <FleetTruck key={t.id} id={t.id} />)}</>
}
