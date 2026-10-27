// Primitive building blocks for low-poly models. Every part reads the highlight state
// from its enclosing <Selectable> and draws a glowing outline when hovered/selected.
import { createContext, memo, useContext, type ReactNode } from 'react'
import * as THREE from 'three'
import { BOX, CYL, WHEEL, mat } from './materials'

/** 0 = none, 1 = hovered, 2 = selected */
export const HighlightCtx = createContext<0 | 1 | 2>(0)

type V3 = [number, number, number]

interface PartProps {
  p?: V3
  s?: V3
  r?: V3
  c: string
  material?: THREE.Material
  shadow?: boolean
  receive?: boolean
  outline?: boolean
  children?: ReactNode
}

const OUTLINE_HOVER = new THREE.MeshBasicMaterial({ color: '#bae6fd', side: THREE.BackSide, toneMapped: false, polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 2 })

/**
 * Inverted-hull outline: a slightly larger back-face copy of the parent part.
 * Thickness is in world units, so it stays even on non-uniformly scaled boxes.
 */
function Highlight({ s, geometry }: { s?: V3; geometry: THREE.BufferGeometry }) {
  const h = useContext(HighlightCtx)
  // selected objects get corner brackets (SelectionBox); the hull is only the hover hint
  if (h !== 1) return null
  const t = 0.08
  const [x, y, z] = s ?? [1, 1, 1]
  return <mesh geometry={geometry} material={OUTLINE_HOVER} scale={[1 + (2 * t) / x, 1 + (2 * t) / y, 1 + (2 * t) / z]} raycast={() => null} />
}

export const B = memo(function B({ p, s, r, c, material, shadow = true, receive = false, outline = true, children }: PartProps) {
  return (
    <mesh position={p} scale={s} rotation={r} geometry={BOX} material={material ?? mat(c)} castShadow={shadow} receiveShadow={receive}>
      {outline && <Highlight s={s} geometry={BOX} />}
      {children}
    </mesh>
  )
})

export const Cyl = memo(function Cyl({ p, s, r, c, material, shadow = true, outline = true }: PartProps) {
  return (
    <mesh position={p} scale={s} rotation={r} geometry={CYL} material={material ?? mat(c)} castShadow={shadow}>
      {outline && <Highlight s={s} geometry={CYL} />}
    </mesh>
  )
})

/** Wheel with its axle along X. Radius/width via scale. */
export const Wheel = memo(function Wheel({ p, radius, width }: { p: V3; radius: number; width: number }) {
  return (
    <mesh position={p} scale={[width, radius * 2, radius * 2]} geometry={WHEEL} material={mat('#1f2937', { rough: 0.95 })} castShadow>
      <mesh scale={[1.04, 0.5, 0.5]} geometry={WHEEL} material={mat('#cbd5e1', { metal: 0.4, rough: 0.5 })} />
    </mesh>
  )
})
