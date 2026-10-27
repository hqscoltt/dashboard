import { memo, useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { useShallow } from 'zustand/react/shallow'
import { engine, type ForkliftSim } from '../simulation/engine'
import { forkliftPos } from '../simulation/traffic'
import { useSim } from '../store/useSimStore'
import { BOX, CARTON_STACK, PALETTE } from './materials'
import { B, Wheel } from './Part'
import { Selectable } from './Selectable'

const C = PALETTE.forklift

export interface ForkliftRefs {
  carriage: RefObject<THREE.Group | null>
  inner: RefObject<THREE.Group | null>
  load: RefObject<THREE.Group | null>
  wheels: RefObject<THREE.Group | null>
  loadMat: THREE.Material
  beacon: THREE.Material
}

/** Forklift geometry (local +Z = forks). Shared by the logistics yard and the universal warehouses. */
export function ForkliftModel({ carriage, inner, load, wheels, loadMat, beacon }: ForkliftRefs) {
  return (
    <>
      {/* body, counterweight, seat */}
      <B p={[0, 0.58, -0.15]} s={[1.15, 0.7, 1.6]} c={C} />
      <B p={[0, 0.78, -0.98]} s={[1.18, 0.95, 0.45]} c="#374151" />
      <B p={[0, 1.08, -0.35]} s={[0.55, 0.3, 0.5]} c="#111827" outline={false} />
      <B p={[0, 1.35, -0.6]} s={[0.55, 0.5, 0.12]} c="#111827" outline={false} />
      <B p={[0, 1.15, 0.22]} s={[0.08, 0.5, 0.08]} c="#111827" outline={false} />
      {/* overhead guard */}
      {[[-0.52, 0.35], [0.52, 0.35], [-0.52, -0.78], [0.52, -0.78]].map(([x, z], i) => (
        <B key={i} p={[x, 1.6, z]} s={[0.07, 1.4, 0.07]} c="#1f2937" outline={false} />
      ))}
      <B p={[0, 2.3, -0.21]} s={[1.15, 0.07, 1.25]} c="#1f2937" />
      <mesh position={[0, 2.4, -0.6]} scale={[0.18, 0.14, 0.18]} geometry={BOX} material={beacon} />
      {/* mast */}
      <B p={[-0.36, 1.2, 0.8]} s={[0.1, 2.2, 0.12]} c="#475569" />
      <B p={[0.36, 1.2, 0.8]} s={[0.1, 2.2, 0.12]} c="#475569" />
      <B p={[0, 2.28, 0.8]} s={[0.82, 0.1, 0.12]} c="#475569" outline={false} />
      <group ref={inner}>
        <B p={[-0.26, 1.25, 0.86]} s={[0.08, 2.1, 0.08]} c="#64748b" outline={false} />
        <B p={[0.26, 1.25, 0.86]} s={[0.08, 2.1, 0.08]} c="#64748b" outline={false} />
      </group>
      <group ref={carriage}>
        <B p={[0, 0.32, 0.92]} s={[0.92, 0.6, 0.06]} c="#334155" />
        <B p={[-0.26, 0.02, 1.48]} s={[0.12, 0.05, 1.1]} c="#1f2937" />
        <B p={[0.26, 0.02, 1.48]} s={[0.12, 0.05, 1.1]} c="#1f2937" />
        <group ref={load} visible={false}>
          <B p={[0, 0.11, 1.45]} s={[1.2, 0.14, 1.0]} c={PALETTE.wood} outline={false} />
          <mesh position={[0, 0.62, 1.45]} scale={[1.08, 0.88, 0.92]} geometry={CARTON_STACK} material={loadMat} castShadow />
        </group>
      </group>
      <group ref={wheels}>
        <Wheel p={[-0.5, 0.3, 0.42]} radius={0.3} width={0.24} />
        <Wheel p={[0.5, 0.3, 0.42]} radius={0.3} width={0.24} />
        <Wheel p={[-0.5, 0.25, -0.85]} radius={0.25} width={0.22} />
        <Wheel p={[0.5, 0.25, -0.85]} radius={0.25} width={0.22} />
      </group>
    </>
  )
}

const Forklift = memo(function Forklift({ id }: { id: string }) {
  const root = useRef<THREE.Group>(null)
  const carriage = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  const load = useRef<THREE.Group>(null)
  const wheels = useRef<THREE.Group>(null)
  const sim = useRef<ForkliftSim | null>(null)
  const gen = useRef(-1)
  const loadMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d6b48a', roughness: 0.85, flatShading: true }), [])
  const beacon = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fbbf24', emissive: '#f59e0b', emissiveIntensity: 0 }), [])

  useFrame(({ clock }) => {
    // Forklift ids repeat across warehouses, so re-resolve the sim object after every load.
    if (!sim.current || gen.current !== engine.generation) {
      sim.current = engine.forklifts.find((f) => f.v.id === id) ?? null
      gen.current = engine.generation
    }
    const f = sim.current
    if (!f || !root.current) return
    const p = forkliftPos(f) // includes the sidestep used when passing other forklifts
    root.current.position.set(p.x, 0, p.z)
    root.current.rotation.y = f.heading
    carriage.current!.position.y = f.forkY
    inner.current!.position.y = Math.max(0, f.forkY - 0.9)
    load.current!.visible = !!f.cargo
    if (f.cargo) loadMat.color.set(f.cargo.color)
    for (const w of wheels.current!.children) w.rotation.x = f.odometer / 0.3
    const busy = f.phase !== 'idle' && f.phase !== 'charge'
    beacon.emissiveIntensity = busy ? (Math.sin(clock.elapsedTime * 10) > 0 ? 2 : 0.2) : 0
  })

  return (
    <group ref={root}>
      <Selectable kind="forklift" id={id} label={id}>
        <ForkliftModel carriage={carriage} inner={inner} load={load} wheels={wheels} loadMat={loadMat} beacon={beacon} />
      </Selectable>
    </group>
  )
})

export function Forklifts() {
  const ids = useSim(useShallow((s) => s.forklifts.map((f) => f.id)))
  return <>{ids.map((id) => <Forklift key={id} id={id} />)}</>
}

/** Pulsing ring under the selected vehicle/dock so it is easy to spot on the map. */
export function SelectionMarker() {
  const sel = useSim((s) => s.selected)
  const ring = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (!ring.current || !sel) return
    const p = engine.positionOf(sel)
    ring.current.visible = !!p
    if (!p) return
    const base = sel.kind === 'truck' ? 6.2 : sel.kind === 'dock' ? 4 : sel.kind === 'pallet' ? 1.6 : 1.9
    const s = base * (1 + Math.sin(clock.elapsedTime * 4) * 0.06)
    ring.current.position.set(p.x, 0.08, p.z)
    ring.current.scale.set(s, s, s)
  })
  if (!sel || sel.kind === 'pallet') return null
  return (
    <mesh ref={ring} rotation={[-Math.PI / 2, 0, 0]} renderOrder={2}>
      <ringGeometry args={[0.86, 1, 48]} />
      <meshBasicMaterial color="#22d3ee" transparent opacity={0.85} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}
