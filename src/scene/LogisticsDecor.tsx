// Extra scenery for the logistics yard: perimeter fence, a closed blue cross-dock building,
// parked trailers, stacked containers, outdoor pallets and lawns.
import { memo, useMemo } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { Container, Fence, Lawn, ParkedTrailer, PalletStack } from './Decor'
import { BOX, mat, textTexture } from './materials'

/** Ribbed metal cladding (vertical corrugation), unit-sized. */
const CLADDING = (() => {
  const parts: THREE.BufferGeometry[] = [new THREE.BoxGeometry(1, 1, 1)]
  for (let x = -0.48; x <= 0.48; x += 0.03) parts.push(new THREE.BoxGeometry(0.008, 1, 0.012).translate(x, 0, 0.506))
  return mergeGeometries(parts.map((p) => p.toNonIndexed()))!
})()

function CrossDock({ x, z }: { x: number; z: number }) {
  const W = 16
  const D = 11
  const H = 5.5
  const sign = useMemo(() => textTexture('CROSS-DOCK', { bg: '#1e3a8a', fg: '#ffffff', w: 512, h: 112 }), [])
  const blue = mat('#2563eb', { rough: 0.55, metal: 0.15 })
  const roofMat = mat('#cbd5e1', { rough: 0.7 })
  const pitch = 0.32
  return (
    <group position={[x, 0, z]}>
      {/* ribbed blue walls: front (+z), right (+x), back, left */}
      <mesh position={[0, H / 2, D / 2]} scale={[W, H, 0.3]} geometry={CLADDING} material={blue} castShadow receiveShadow />
      <mesh position={[W / 2, H / 2, 0]} rotation={[0, Math.PI / 2, 0]} scale={[D, H, 0.3]} geometry={CLADDING} material={blue} castShadow receiveShadow />
      <mesh position={[0, H / 2, -D / 2]} scale={[W, H, 0.3]} geometry={BOX} material={blue} castShadow />
      <mesh position={[-W / 2, H / 2, 0]} scale={[0.3, H, D]} geometry={BOX} material={blue} castShadow />
      {/* gable roof */}
      <mesh position={[0, H + Math.tan(pitch) * (D / 4), D / 4]} rotation={[pitch, 0, 0]} scale={[W + 0.8, 0.25, D / 2 / Math.cos(pitch) + 0.5]} geometry={BOX} material={roofMat} castShadow />
      <mesh position={[0, H + Math.tan(pitch) * (D / 4), -D / 4]} rotation={[-pitch, 0, 0]} scale={[W + 0.8, 0.25, D / 2 / Math.cos(pitch) + 0.5]} geometry={BOX} material={roofMat} castShadow />
      <mesh position={[W / 2 + 0.02, H + 0.6, 0]} scale={[0.25, 1.4, D]} geometry={BOX} material={blue} />
      <mesh position={[-W / 2 - 0.02, H + 0.6, 0]} scale={[0.25, 1.4, D]} geometry={BOX} material={blue} />
      {/* three dock doors with canopies */}
      {[-5, 0, 5].map((dx) => (
        <group key={dx} position={[dx, 0, D / 2 + 0.17]}>
          <mesh position={[0, 1.9, 0]} scale={[3, 3.6, 0.08]} geometry={BOX} material={mat('#e2e8f0', { rough: 0.6 })} />
          {[0.6, 1.3, 2, 2.7, 3.4].map((y) => <mesh key={y} position={[0, y, 0.05]} scale={[3, 0.04, 0.03]} geometry={BOX} material={mat('#cbd5e1')} />)}
          <mesh position={[0, 4.05, 0.7]} rotation={[0.25, 0, 0]} scale={[3.8, 0.12, 1.6]} geometry={BOX} material={mat('#1e3a8a')} castShadow />
          <mesh position={[-1.2, 1, 0.25]} scale={[0.32, 0.45, 0.3]} geometry={BOX} material={mat('#111827')} />
          <mesh position={[1.2, 1, 0.25]} scale={[0.32, 0.45, 0.3]} geometry={BOX} material={mat('#111827')} />
        </group>
      ))}
      <mesh position={[0, H - 0.6, D / 2 + 0.2]} scale={[4.4, 0.96, 1]}>
        <planeGeometry />
        <meshBasicMaterial map={sign} toneMapped={false} />
      </mesh>
      <mesh position={[0, 0.02, D / 2 + 5]} scale={[W, 1, 9]} rotation={[-Math.PI / 2, 0, 0]} material={mat('#c3ccd6', { rough: 1 })} receiveShadow>
        <planeGeometry />
      </mesh>
    </group>
  )
}

export const LogisticsDecor = memo(function LogisticsDecor() {
  const fence = useMemo<[number, number, number, number][]>(() => [
    [-53, -32, 48, -32], // back
    [-53, -32, -53, 24], // left
    [48, -32, 48, 24], // right
    [-53, 24, -31.5, 24], // front, left of the gatehouse (the yard front stays open for trucks)
    [45, 24, 48, 24],
  ], [])
  return (
    <group>
      <Fence segments={fence} />
      <CrossDock x={36} z={-21} />
      <ParkedTrailer x={29} z={-5} stripe="#2563eb" />
      <ParkedTrailer x={33} z={-5} stripe="#0ea5e9" />
      <ParkedTrailer x={41} z={-5} stripe="#1e40af" />
      {[29, 33, 37, 41].map((x) => (
        <mesh key={x} position={[x + 2, 0.02, -5]} rotation={[-Math.PI / 2, 0, 0]} scale={[0.12, 9, 1]} material={mat('#facc15')}>
          <planeGeometry />
        </mesh>
      ))}
      <Container x={-46} z={-26} color="#0d9488" />
      <Container x={-46} z={-23.4} color="#2563eb" />
      <Container x={-46} z={-26} y={2.6} color="#ea580c" />
      <Container x={-38.5} z={-26} color="#64748b" rot={0} />
      <Lawn x={0} z={36} w={140} d={3} />
      <Lawn x={-40} z={-10} w={14} d={30} />
      <PalletStack x={-22.6} z={0.4} layers={2} />
      <PalletStack x={-21.1} z={0.4} wrapped color="#3b82f6" />
      <PalletStack x={-22.6} z={1.9} wrapped color="#3b82f6" layers={2} />
      <PalletStack x={23} z={0.6} />
      <PalletStack x={23} z={2.1} layers={2} color="#d6b48a" />
    </group>
  )
})
