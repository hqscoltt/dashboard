// Rack structure and pallets, all instanced: 3 draw calls for 144 pallet slots.
// The pallet instances are refreshed only when engine.slotsVersion changes.
import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import {
  RACK_BAY_WIDTH, RACK_BAY_XS, RACK_DEPTH, RACK_HEIGHT, RACK_LEVELS, RACK_ROWS, SLOT_COUNT, slotPosition,
} from '../data/layout'
import { engine } from '../simulation/engine'
import { useSim } from '../store/useSimStore'
import { BOX, CARTON_STACK, PALETTE, PALLET, WRAPPED_BLOCK, mat } from './materials'

const HIDDEN = new THREE.Matrix4().makeTranslation(0, -1000, 0)

function RackFrames() {
  const posts = useRef<THREE.InstancedMesh>(null)
  const beams = useRef<THREE.InstancedMesh>(null)
  const { postList, beamList } = useMemo(() => {
    const postList: [number, number][] = []
    const beamList: [number, number, number, number][] = [] // cx, y, z, length
    const beamYs = [RACK_LEVELS[1] - 0.09, RACK_LEVELS[2] - 0.09, RACK_HEIGHT - 0.1]
    for (const row of RACK_ROWS) {
      for (const half of [RACK_BAY_XS.slice(0, 8), RACK_BAY_XS.slice(8)]) {
        const x0 = half[0] - RACK_BAY_WIDTH / 2
        const x1 = half[half.length - 1] + RACK_BAY_WIDTH / 2
        for (let i = 0; i <= half.length; i++)
          for (const s of [-1, 1]) postList.push([x0 + i * RACK_BAY_WIDTH, row.z + (s * RACK_DEPTH) / 2])
        for (const y of beamYs)
          for (const s of [-1, 1]) beamList.push([(x0 + x1) / 2, y, row.z + (s * RACK_DEPTH) / 2, x1 - x0])
      }
    }
    return { postList, beamList }
  }, [])

  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    postList.forEach(([x, z], i) => posts.current!.setMatrixAt(i, m.compose(new THREE.Vector3(x, RACK_HEIGHT / 2, z), new THREE.Quaternion(), new THREE.Vector3(0.12, RACK_HEIGHT, 0.12))))
    beamList.forEach(([x, y, z, l], i) => beams.current!.setMatrixAt(i, m.compose(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(l, 0.14, 0.09))))
    posts.current!.instanceMatrix.needsUpdate = true
    beams.current!.instanceMatrix.needsUpdate = true
  }, [postList, beamList])

  return (
    <>
      <instancedMesh ref={posts} args={[BOX, mat(PALETTE.rackUpright, { metal: 0.3, rough: 0.5 }), postList.length]} castShadow />
      <instancedMesh ref={beams} args={[BOX, mat(PALETTE.rackBeam, { metal: 0.2, rough: 0.55 }), beamList.length]} castShadow />
    </>
  )
}

function hash(s: string) {
  let h = 0
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0
  return Math.abs(h)
}

function Pallets() {
  const bases = useRef<THREE.InstancedMesh>(null)
  const loads = useRef<THREE.InstancedMesh>(null)
  const wraps = useRef<THREE.InstancedMesh>(null)
  const seen = useRef(-1)

  useFrame(() => {
    if (seen.current === engine.slotsVersion || !bases.current || !loads.current || !wraps.current) return
    seen.current = engine.slotsVersion
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const c = new THREE.Color()
    for (let i = 0; i < SLOT_COUNT; i++) {
      const meta = engine.slots[i]
      if (!meta) {
        bases.current.setMatrixAt(i, HIDDEN)
        loads.current.setMatrixAt(i, HIDDEN)
        wraps.current.setMatrixAt(i, HIDDEN)
        continue
      }
      const p = slotPosition(i)
      const h = 0.78 + (hash(meta.id) % 30) / 100
      bases.current.setMatrixAt(i, m.compose(new THREE.Vector3(p.x, p.y + 0.07, p.z), q, new THREE.Vector3(1.2, 0.14, 1.0)))
      // blue goods are stretch-wrapped blocks, everything else is a stack of taped cartons
      c.set(meta.color)
      const hsl = c.getHSL({ h: 0, s: 0, l: 0 })
      const wrapped = hsl.h > 0.5 && hsl.h < 0.72 && hsl.s > 0.35
      m.compose(new THREE.Vector3(p.x, p.y + 0.14 + h / 2, p.z), q, new THREE.Vector3(1.08, h, 0.92))
      loads.current.setMatrixAt(i, wrapped ? HIDDEN : m)
      wraps.current.setMatrixAt(i, wrapped ? m : HIDDEN)
      ;(wrapped ? wraps : loads).current!.setColorAt(i, c)
    }
    bases.current.instanceMatrix.needsUpdate = true
    loads.current.instanceMatrix.needsUpdate = true
    if (loads.current.instanceColor) loads.current.instanceColor.needsUpdate = true
    wraps.current.instanceMatrix.needsUpdate = true
    if (wraps.current.instanceColor) wraps.current.instanceColor.needsUpdate = true
    wraps.current.computeBoundingSphere()
    bases.current.computeBoundingSphere()
    loads.current.computeBoundingSphere()
  })

  const lastHover = useRef(-1)
  const onMove = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    const id = e.instanceId ?? -1
    if (id === lastHover.current) return
    lastHover.current = id
    const meta = engine.slots[id]
    document.body.style.cursor = 'pointer'
    useSim.getState().setHovered({ label: meta ? `${meta.id} · ${slotPosition(id).label}` : slotPosition(id).label, kind: 'pallet', id: String(id) })
  }
  const onOut = () => {
    lastHover.current = -1
    document.body.style.cursor = ''
    useSim.getState().setHovered(null)
  }
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6 || e.instanceId === undefined) return
    useSim.getState().select({ kind: 'pallet', id: String(e.instanceId) })
  }

  // three needs an initial color buffer before the first setColorAt for the material to use it
  const initColors = useMemo(() => new THREE.InstancedBufferAttribute(new Float32Array(SLOT_COUNT * 3).fill(1), 3), [])
  const initColorsW = useMemo(() => new THREE.InstancedBufferAttribute(new Float32Array(SLOT_COUNT * 3).fill(1), 3), [])

  return (
    <>
      <instancedMesh ref={bases} args={[PALLET, mat(PALETTE.wood), SLOT_COUNT]} castShadow onClick={onClick} onPointerMove={onMove} onPointerOut={onOut} />
      <instancedMesh ref={loads} args={[CARTON_STACK, undefined, SLOT_COUNT]} instanceColor={initColors} castShadow receiveShadow onClick={onClick} onPointerMove={onMove} onPointerOut={onOut}>
        <meshStandardMaterial roughness={0.85} flatShading />
      </instancedMesh>
      <instancedMesh ref={wraps} args={[WRAPPED_BLOCK, undefined, SLOT_COUNT]} instanceColor={initColorsW} castShadow receiveShadow onClick={onClick} onPointerMove={onMove} onPointerOut={onOut}>
        <meshStandardMaterial roughness={0.45} flatShading />
      </instancedMesh>
    </>
  )
}

function SlotHighlight() {
  const sel = useSim((s) => (s.selected?.kind === 'pallet' ? Number(s.selected.id) : -1))
  const ref = useRef<THREE.Mesh>(null)
  useFrame(({ clock }) => {
    if (ref.current) (ref.current.material as THREE.MeshBasicMaterial).opacity = 0.18 + Math.sin(clock.elapsedTime * 4) * 0.08
  })
  if (sel < 0) return null
  const p = slotPosition(sel)
  return (
    <mesh ref={ref} raycast={() => null} position={[p.x, p.y + 0.62, p.z]} scale={[1.5, 1.3, 1.25]} geometry={BOX}>
      <meshBasicMaterial color="#22d3ee" transparent opacity={0.2} depthWrite={false} />
      <mesh geometry={BOX} scale={[1.1, 1.1, 1.1]}>
        <meshBasicMaterial color="#22d3ee" side={THREE.BackSide} toneMapped={false} />
      </mesh>
    </mesh>
  )
}

export const Racks = memo(function Racks() {
  return (
    <group>
      <RackFrames />
      <Pallets />
      <SlotHighlight />
    </group>
  )
})
