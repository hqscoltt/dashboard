import { memo, useRef } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { useShallow } from 'zustand/react/shallow'
import { Lighting } from '../../scene/Lighting'
import { useUniverse } from '../store'
import { HQBuilding, StageBuilding, StockBuilding } from './Buildings'
import { UTrucks } from './UTrucks'
import { UniverseSelection } from './USelection'
import { UCamera } from './UCamera'
import { UGround } from './UGround'

/** Sun + shadows sized to the generated site. */
function SiteLighting() {
  const b = useUniverse(useShallow((s) => s.layout.bounds))
  const extent = Math.min(130, Math.max(60, (b.maxX - b.minX + b.maxZ - b.minZ) * 0.45))
  return <Lighting center={[(b.minX + b.maxX) / 2, (b.minZ + b.maxZ) / 2]} extent={extent} />
}

function City() {
  // re-render only when the set of buildings changes, not when they resize
  const ids = useUniverse(useShallow((s) => s.layout.order))
  return (
    <>
      {ids.map((id) =>
        id === 'hq' ? <HQBuilding key={id} /> : id.startsWith('stock:') ? <StockBuilding key={id} id={id} /> : <StageBuilding key={id} id={id} />,
      )}
    </>
  )
}

export const UScene = memo(function UScene() {
  const down = useRef({ x: 0, y: 0 })
  return (
    <Canvas
      shadows={{ type: THREE.PCFShadowMap }}
      dpr={[1, 2]}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
      onPointerMissed={(e) => {
        if (Math.hypot(e.clientX - down.current.x, e.clientY - down.current.y) < 6) useUniverse.getState().select(null)
      }}
    >
      <UCamera />
      <SiteLighting />
      <UGround />
      <City />
      <UTrucks />
      <UniverseSelection />
    </Canvas>
  )
})
