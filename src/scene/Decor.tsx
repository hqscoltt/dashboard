// Scenery shared by the logistics yard and the universal dashboard: fences, cars, parked
// trailers, shipping containers, outdoor pallet stacks and lawns. Static, mostly instanced.
import { memo, useLayoutEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { BOX, CARTON_STACK, PALLET, PLANE, PALETTE, WRAPPED_BLOCK, mat } from './materials'
import { B, Wheel } from './Part'

// ------------------------------------------------------------------ fence

/** Chain-link style fence along polylines; `segments` are [x0, z0, x1, z1]. */
export const Fence = memo(function Fence({ segments, height = 2 }: { segments: [number, number, number, number][]; height?: number }) {
  const posts = useRef<THREE.InstancedMesh>(null)
  const panels = useRef<THREE.InstancedMesh>(null)
  const rails = useRef<THREE.InstancedMesh>(null)
  const { p, pan, r } = useMemo(() => {
    const p: [number, number][] = []
    const pan: [number, number, number, number][] = [] // cx, cz, len, angle
    const r: [number, number, number, number][] = []
    for (const [x0, z0, x1, z1] of segments) {
      const len = Math.hypot(x1 - x0, z1 - z0)
      const n = Math.max(1, Math.round(len / 2.6))
      const ang = Math.atan2(z1 - z0, x1 - x0)
      for (let i = 0; i <= n; i++) p.push([x0 + ((x1 - x0) * i) / n, z0 + ((z1 - z0) * i) / n])
      for (let i = 0; i < n; i++) {
        const t = (i + 0.5) / n
        pan.push([x0 + (x1 - x0) * t, z0 + (z1 - z0) * t, len / n, ang])
      }
      r.push([(x0 + x1) / 2, (z0 + z1) / 2, len, ang])
    }
    return { p, pan, r }
  }, [segments])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    const up = new THREE.Vector3(0, 1, 0)
    p.forEach(([x, z], i) => posts.current!.setMatrixAt(i, m.compose(new THREE.Vector3(x, height / 2, z), q.identity(), new THREE.Vector3(0.1, height, 0.1))))
    pan.forEach(([x, z, l, a], i) => panels.current!.setMatrixAt(i, m.compose(new THREE.Vector3(x, height * 0.48, z), q.setFromAxisAngle(up, -a), new THREE.Vector3(l - 0.12, height * 0.9, 0.03))))
    r.forEach(([x, z, l, a], i) => rails.current!.setMatrixAt(i, m.compose(new THREE.Vector3(x, height, z), q.setFromAxisAngle(up, -a), new THREE.Vector3(l, 0.07, 0.07))))
    for (const ref of [posts, panels, rails]) {
      ref.current!.instanceMatrix.needsUpdate = true
      ref.current!.computeBoundingSphere()
    }
  }, [p, pan, r, height])
  return (
    <>
      <instancedMesh ref={posts} args={[BOX, mat('#64748b', { metal: 0.3 }), p.length]} castShadow />
      <instancedMesh ref={panels} args={[BOX, undefined, pan.length]}>
        <meshStandardMaterial color="#94a3b8" transparent opacity={0.35} depthWrite={false} />
      </instancedMesh>
      <instancedMesh ref={rails} args={[BOX, mat('#64748b', { metal: 0.3 }), r.length]} />
    </>
  )
})

// ------------------------------------------------------------------ vehicles

export function Car({ x, z, color, rot = 0 }: { x: number; z: number; color: string; rot?: number }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <B p={[0, 0.55, 0]} s={[1.7, 0.6, 3.9]} c={color} outline={false} />
      <B p={[0, 1.08, -0.2]} s={[1.5, 0.5, 2]} c={color} outline={false} />
      <mesh position={[0, 1.08, -0.2]} scale={[1.52, 0.36, 1.7]} geometry={BOX} material={mat(PALETTE.glass, { rough: 0.2, metal: 0.4 })} />
      {[[-0.85, 1.25], [0.85, 1.25], [-0.85, -1.25], [0.85, -1.25]].map(([wx, wz], i) => (
        <Wheel key={i} p={[wx, 0.32, wz]} radius={0.32} width={0.25} />
      ))}
    </group>
  )
}

/** A trailer parked without its cab, resting on its landing legs. */
export function ParkedTrailer({ x, z, rot = 0, stripe = '#2563eb' }: { x: number; z: number; rot?: number; stripe?: string }) {
  return (
    <group position={[x, 0, z]} rotation={[0, rot, 0]}>
      <B p={[0, 2.55, 0]} s={[2.6, 2.9, 7.6]} c="#f8fafc" outline={false} />
      <B p={[0, 1.25, 0]} s={[2.62, 0.35, 7.54]} c={stripe} outline={false} />
      <B p={[0, 0.85, 0]} s={[1.3, 0.3, 7.4]} c="#334155" outline={false} />
      <B p={[-0.8, 0.5, 2.6]} s={[0.12, 0.9, 0.12]} c="#475569" outline={false} />
      <B p={[0.8, 0.5, 2.6]} s={[0.12, 0.9, 0.12]} c="#475569" outline={false} />
      {[-2.6, -3.6].flatMap((wz) => [-1, 1].map((s) => <Wheel key={`${wz}${s}`} p={[s * 1.1, 0.52, wz]} radius={0.52} width={0.42} />))}
    </group>
  )
}

// ------------------------------------------------------------------ containers

const CONTAINER = (() => {
  const parts: THREE.BufferGeometry[] = [new THREE.BoxGeometry(1, 1, 1)]
  // corrugation ribs on both long sides
  for (let i = -0.46; i <= 0.46; i += 0.046) {
    parts.push(new THREE.BoxGeometry(0.012, 0.92, 0.02).translate(i, 0, 0.505))
    parts.push(new THREE.BoxGeometry(0.012, 0.92, 0.02).translate(i, 0, -0.505))
  }
  return mergeGeometries(parts.map((p) => p.toNonIndexed()))!
})()

export function Container({ x, z, y = 0, rot = 0, color = '#0d9488' }: { x: number; z: number; y?: number; rot?: number; color?: string }) {
  return (
    <group position={[x, y, z]} rotation={[0, rot, 0]}>
      <mesh position={[0, 1.3, 0]} scale={[6, 2.6, 2.44]} geometry={CONTAINER} material={mat(color, { rough: 0.6 })} castShadow receiveShadow />
      <mesh position={[3.02, 1.3, 0]} scale={[0.05, 2.4, 2.3]} geometry={BOX} material={mat('#1f2937')} />
    </group>
  )
}

// ------------------------------------------------------------------ outdoor pallets and lawn

export function PalletStack({ x, z, color = '#c8a27a', wrapped = false, layers = 1 }: { x: number; z: number; color?: string; wrapped?: boolean; layers?: number }) {
  return (
    <group position={[x, 0, z]}>
      {Array.from({ length: layers }, (_, i) => (
        <group key={i} position={[0, i * 1.12, 0]}>
          <mesh position={[0, 0.07, 0]} scale={[1.2, 0.14, 1]} geometry={PALLET} material={mat('#c9a77c')} castShadow />
          <mesh position={[0, 0.6, 0]} scale={[1.08, 0.92, 0.92]} geometry={wrapped ? WRAPPED_BLOCK : CARTON_STACK} material={mat(color, { rough: wrapped ? 0.45 : 0.85 })} castShadow />
        </group>
      ))}
    </group>
  )
}

export function Lawn({ x, z, w, d }: { x: number; z: number; w: number; d: number }) {
  return <mesh position={[x, 0.006, z]} scale={[w, 1, d]} geometry={PLANE} material={mat('#b7d7bf', { rough: 1 })} receiveShadow />
}

export function ParkingStripes({ x, z, count, pitch = 3, depth = 5.2, rot = 0 }: { x: number; z: number; count: number; pitch?: number; depth?: number; rot?: number }) {
  return (
    <group position={[x, 0.02, z]} rotation={[0, rot, 0]}>
      {Array.from({ length: count + 1 }, (_, i) => (
        <mesh key={i} position={[i * pitch, 0, 0]} scale={[0.12, 1, depth]} geometry={PLANE} material={mat('#ffffff')} />
      ))}
    </group>
  )
}
