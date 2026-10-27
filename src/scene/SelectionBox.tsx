// Selection feedback shared by both dashboards: glowing corner brackets around the selected
// object, a floating label pill, and the dotted route a vehicle is about to drive with a pin
// at its destination.
import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { BOX } from './materials'

export interface BoxInfo {
  x: number
  y: number // center height
  z: number
  w: number // along local X
  h: number
  d: number // along local Z
  rot: number
}

const bracketMat = new THREE.MeshBasicMaterial({ color: '#22d3ee', toneMapped: false })

export function SelectionBox({ get, label, status, color = '#2563eb' }: { get: () => BoxInfo | null; label: string; status?: string; color?: string }) {
  const group = useRef<THREE.Group>(null)
  const edges = useRef<THREE.InstancedMesh>(null)
  const tag = useRef<THREE.Group>(null)
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const s = useMemo(() => new THREE.Vector3(), [])

  useFrame(({ clock }) => {
    const b = get()
    const g = group.current
    if (!g || !edges.current) return
    g.visible = !!b
    if (!b) return
    const pulse = 1 + Math.sin(clock.elapsedTime * 4) * 0.025
    g.position.set(b.x, b.y, b.z)
    g.rotation.y = b.rot
    const hw = (b.w / 2) * pulse
    const hh = (b.h / 2) * pulse
    const hd = (b.d / 2) * pulse
    const L = Math.min(1.3, Math.max(0.3, Math.min(b.w, b.h, b.d) * 0.3))
    const t = 0.07
    let i = 0
    for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
      // three short edges leaving each corner, pointing inwards
      m.compose(v.set(sx * hw - (sx * L) / 2, sy * hh, sz * hd), q, s.set(L, t, t)); edges.current.setMatrixAt(i++, m)
      m.compose(v.set(sx * hw, sy * hh - (sy * L) / 2, sz * hd), q, s.set(t, L, t)); edges.current.setMatrixAt(i++, m)
      m.compose(v.set(sx * hw, sy * hh, sz * hd - (sz * L) / 2), q, s.set(t, t, L)); edges.current.setMatrixAt(i++, m)
    }
    edges.current.instanceMatrix.needsUpdate = true
    if (tag.current) {
      tag.current.position.set(0, hh + 0.9, 0)
      tag.current.rotation.y = -b.rot // keep the label upright relative to the world
    }
  })

  return (
    <group ref={group}>
      <instancedMesh ref={edges} args={[BOX, bracketMat, 24]} frustumCulled={false} raycast={() => null} renderOrder={5} />
      <group ref={tag}>
        <Html center zIndexRange={[20, 0]} style={{ pointerEvents: 'none' }}>
          <div className="flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-white/95 px-2 py-1 text-[11px] font-bold text-slate-800 shadow-lg ring-1 ring-slate-900/5">
            {label}
            {status && <span className="rounded-md px-1.5 py-0.5 text-[10px] font-semibold text-white" style={{ background: color }}>{status}</span>}
          </div>
        </Html>
      </group>
    </group>
  )
}

const DOTS = 90
const dotGeo = new THREE.CylinderGeometry(0.22, 0.22, 0.05, 12)
const dotMat = new THREE.MeshBasicMaterial({ color: '#2563eb', toneMapped: false })
const pinMat = new THREE.MeshStandardMaterial({ color: '#2563eb', emissive: '#1d4ed8', emissiveIntensity: 0.4, roughness: 0.4 })

/** Dotted route from the vehicle to its destination + a bobbing pin. `get` returns [current, ...waypoints]. */
export function RoutePath({ get }: { get: () => { x: number; z: number }[] | null }) {
  const dots = useRef<THREE.InstancedMesh>(null)
  const pin = useRef<THREE.Group>(null)
  const m = useMemo(() => new THREE.Matrix4(), [])
  const q = useMemo(() => new THREE.Quaternion(), [])
  const v = useMemo(() => new THREE.Vector3(), [])
  const one = useMemo(() => new THREE.Vector3(1, 1, 1), [])
  const hidden = useMemo(() => new THREE.Matrix4().makeTranslation(0, -999, 0), [])

  useFrame(({ clock }) => {
    const pts = get()
    if (!dots.current || !pin.current) return
    let n = 0
    if (pts && pts.length > 1) {
      // walk the polyline placing a dot every 1.3 m, skipping the first stretch under the vehicle
      let carry = 2.2
      for (let i = 0; i < pts.length - 1 && n < DOTS; i++) {
        const a = pts[i]
        const b = pts[i + 1]
        const len = Math.hypot(b.x - a.x, b.z - a.z)
        let t = carry
        while (t < len && n < DOTS) {
          const k = t / len
          const shrink = 1 - (n / DOTS) * 0.35
          m.compose(v.set(a.x + (b.x - a.x) * k, 0.06, a.z + (b.z - a.z) * k), q, one.set(shrink, 1, shrink))
          dots.current.setMatrixAt(n++, m)
          t += 1.3
        }
        carry = t - len
      }
      const end = pts[pts.length - 1]
      pin.current.visible = true
      pin.current.position.set(end.x, 0, end.z)
      pin.current.children[0].position.y = 3 + Math.sin(clock.elapsedTime * 3) * 0.25
    } else pin.current.visible = false
    one.set(1, 1, 1)
    for (let i = n; i < DOTS; i++) dots.current.setMatrixAt(i, hidden)
    dots.current.instanceMatrix.needsUpdate = true
  })

  return (
    <>
      <instancedMesh ref={dots} args={[dotGeo, dotMat, DOTS]} frustumCulled={false} raycast={() => null} />
      <group ref={pin} visible={false}>
        <group>
          <mesh position={[0, 0.55, 0]} scale={[0.75, 0.75, 0.75]} material={pinMat}>
            <sphereGeometry args={[1, 20, 14]} />
          </mesh>
          <mesh position={[0, -0.35, 0]} rotation={[Math.PI, 0, 0]} material={pinMat}>
            <coneGeometry args={[0.55, 1.4, 20]} />
          </mesh>
          <mesh position={[0, 0.55, 0.6]} scale={[0.32, 0.32, 0.32]}>
            <sphereGeometry args={[1, 12, 10]} />
            <meshBasicMaterial color="#ffffff" />
          </mesh>
        </group>
        <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]} raycast={() => null}>
          <ringGeometry args={[0.7, 1.1, 32]} />
          <meshBasicMaterial color="#2563eb" transparent opacity={0.55} toneMapped={false} />
        </mesh>
      </group>
    </>
  )
}
