import { memo, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useShallow } from 'zustand/react/shallow'
import { TRUCK_WIDTH } from '../data/layout'
import { YARD_STATUSES, engine, type TruckSim } from '../simulation/engine'
import { useSim } from '../store/useSimStore'
import { BOX, PALETTE, mat, nightGlow } from './materials'
import { B, Wheel } from './Part'
import { Selectable } from './Selectable'

export const WHEEL_R = 0.52
const Y_AXIS = new THREE.Vector3(0, 1, 0)
const TW = TRUCK_WIDTH

const VARIANTS = [
  { cab: '#2563eb', stripe: '#2563eb' },
  { cab: '#f8fafc', stripe: '#0ea5e9' },
  { cab: '#1e40af', stripe: '#60a5fa' },
  { cab: '#e2e8f0', stripe: '#2563eb' },
]

/** Truck geometry (origin at the center, cab towards local +Z). */
export function TruckModel({ variant }: { variant: number }) {
  const v = VARIANTS[variant % VARIANTS.length]
  return (
    <>
      {/* chassis */}
      <B p={[0, 0.85, 0]} s={[1.3, 0.3, 9.8]} c="#334155" />
      {/* trailer */}
      <B p={[0, 2.6, -1.35]} s={[TW, 2.9, 7.5]} c="#f8fafc" />
      <B p={[0, 1.3, -1.35]} s={[TW + 0.02, 0.35, 7.46]} c={v.stripe} outline={false} />
      <B p={[0, 3.95, -1.35]} s={[TW + 0.04, 0.12, 7.54]} c="#cbd5e1" outline={false} />
      <B p={[TW / 2 + 0.01, 2.75, -1.35]} s={[0.02, 0.5, 5.6]} c={v.stripe} outline={false} />
      <B p={[-TW / 2 - 0.01, 2.75, -1.35]} s={[0.02, 0.5, 5.6]} c={v.stripe} outline={false} />
      {/* rear doors + lights */}
      <B p={[0, 2.6, -5.11]} s={[0.05, 2.7, 0.04]} c="#94a3b8" outline={false} />
      <B p={[-0.95, 1.35, -5.12]} s={[0.35, 0.18, 0.05]} c="#ef4444" outline={false} />
      <B p={[0.95, 1.35, -5.12]} s={[0.35, 0.18, 0.05]} c="#ef4444" outline={false} />
      {/* cab */}
      <B p={[0, 2.05, 3.85]} s={[TW - 0.05, 2.5, 2.4]} c={v.cab} />
      <B p={[0, 3.45, 3.6]} s={[TW - 0.25, 0.4, 1.8]} c={v.cab} outline={false} />
      <mesh position={[0, 2.55, 5.06]} scale={[TW - 0.3, 1.05, 0.05]} geometry={BOX} material={mat(PALETTE.glass, { rough: 0.15, metal: 0.5 })} />
      <mesh position={[TW / 2 - 0.02, 2.55, 4.3]} scale={[0.05, 0.9, 1]} geometry={BOX} material={mat(PALETTE.glass, { rough: 0.15, metal: 0.5 })} />
      <mesh position={[-TW / 2 + 0.02, 2.55, 4.3]} scale={[0.05, 0.9, 1]} geometry={BOX} material={mat(PALETTE.glass, { rough: 0.15, metal: 0.5 })} />
      <B p={[0, 1.05, 5.1]} s={[TW - 0.1, 0.45, 0.15]} c="#cbd5e1" outline={false} />
      <mesh position={[-0.9, 1.4, 5.08]} scale={[0.4, 0.22, 0.05]} geometry={BOX} material={nightGlow.headlight} />
      <mesh position={[0.9, 1.4, 5.08]} scale={[0.4, 0.22, 0.05]} geometry={BOX} material={nightGlow.headlight} />
      <B p={[TW / 2 + 0.12, 2.7, 4.9]} s={[0.08, 0.45, 0.12]} c="#1f2937" outline={false} />
      <B p={[-TW / 2 - 0.12, 2.7, 4.9]} s={[0.08, 0.45, 0.12]} c="#1f2937" outline={false} />
      <B p={[0.85, 3.4, 2.75]} s={[0.15, 1.2, 0.15]} c="#64748b" outline={false} />
    </>
  )
}

function ProgressBar({ sim }: { sim: RefObject<TruckSim | null> }) {
  const group = useRef<THREE.Group>(null)
  const fill = useRef<THREE.Mesh>(null)
  useFrame(({ camera }) => {
    const t = sim.current
    if (!group.current || !fill.current || !t) return
    const active = t.v.status === 'carregando' || t.v.status === 'descarregando'
    group.current.visible = active
    if (!active) return
    fill.current.scale.x = Math.max(0.001, t.v.progress) * 3.6
    fill.current.position.x = -1.8 + fill.current.scale.x / 2
    // billboard: undo the truck heading, then face the camera
    group.current.quaternion.setFromAxisAngle(Y_AXIS, -t.heading).multiply(camera.quaternion)
  })
  return (
    <group ref={group} position={[0, 5.2, -1.2]}>
      <mesh scale={[3.8, 0.42, 0.05]} geometry={BOX} material={mat('#0f172a', { rough: 1 })} />
      <mesh ref={fill} position={[0, 0, 0.04]} scale={[1, 0.28, 0.05]} geometry={BOX} material={mat('#22d3ee', { emissive: '#22d3ee', ei: 0.6 })} />
    </group>
  )
}

const Truck = memo(function Truck({ id }: { id: string }) {
  const root = useRef<THREE.Group>(null)
  const wheels = useRef<THREE.Group>(null)
  const sim = useRef<TruckSim | null>(null)
  const gen = useRef(-1)
  const variant = useMemo(() => [...id].reduce((a, c) => a + c.charCodeAt(0), 0), [id])

  useFrame(() => {
    if (!sim.current || gen.current !== engine.generation) {
      sim.current = engine.trucks.find((t) => t.v.id === id) ?? null
      gen.current = engine.generation
    }
    const t = sim.current
    const g = root.current
    if (!t || !g) return
    g.visible = t.visible
    g.position.set(t.x, 0, t.z)
    g.rotation.y = t.heading
    const a = t.odometer / WHEEL_R
    for (const w of wheels.current!.children) w.rotation.x = a
  })

  return (
    <group ref={root}>
      <Selectable kind="truck" id={id} label={id}>
        <TruckModel variant={variant} />
        <group ref={wheels}>
          {[4.1, -3.2, -4.3].flatMap((z) => [-1, 1].map((s) => (
            <Wheel key={`${z}${s}`} p={[s * (TW / 2 - 0.2), WHEEL_R, z]} radius={WHEEL_R} width={0.42} />
          )))}
        </group>
      </Selectable>
      <ProgressBar sim={sim} />
    </group>
  )
})

export function Trucks() {
  const ids = useSim(useShallow((s) => s.trucks.filter((t) => YARD_STATUSES.includes(t.status)).map((t) => t.id)))
  return <>{ids.map((id) => <Truck key={id} id={id} />)}</>
}
