import { memo, useEffect, useRef } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { WAREHOUSES } from '../data/mockData'
import { engine } from '../simulation/engine'
import { useSim } from '../store/useSimStore'
import { CameraRig } from './CameraRig'
import { Forklifts } from './Forklift'
import { LogisticsSelection } from './LogisticsSelection'
import { Ground } from './Ground'
import { Lighting } from './Lighting'
import { LogisticsDecor } from './LogisticsDecor'
import { themeMats } from './materials'
import { Office } from './Office'
import { Racks } from './Racks'
import { Trucks } from './Truck'
import { Warehouse } from './Warehouse'

/** Advances the simulation before any visual reads positions this frame. */
function SimDriver() {
  useFrame((_, dt) => engine.update(dt), -1)
  const scene = useThree((s) => s.scene)
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).__scene = scene
  return null
}

/** Recolors the shared theme materials when the warehouse changes. */
function ThemeSync() {
  const id = useSim((s) => s.warehouseId)
  useEffect(() => {
    const { theme } = WAREHOUSES.find((w) => w.id === id) ?? WAREHOUSES[0]
    themeMats.trim.color.set(theme.accent)
    themeMats.ground.color.set(theme.ground)
    themeMats.yard.color.set(theme.yard)
  }, [id])
  return null
}

export const Scene = memo(function Scene() {
  const down = useRef({ x: 0, y: 0 })
  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
      onPointerMissed={(e) => {
        if (Math.hypot(e.clientX - down.current.x, e.clientY - down.current.y) < 6) useSim.getState().select(null)
      }}
    >
      <SimDriver />
      <ThemeSync />
      <CameraRig />
      <Lighting />
      <Ground />
      <Office />
      <LogisticsDecor />
      <Warehouse />
      <Racks />
      <Trucks />
      <Forklifts />
      <LogisticsSelection />
    </Canvas>
  )
})
