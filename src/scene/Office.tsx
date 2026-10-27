import { memo, useMemo } from 'react'
import { OFFICE } from '../data/layout'
import { BOX, PALETTE, PLANE, mat, nightGlow, textTexture, themeMats } from './materials'
import { B, Wheel } from './Part'

function Car({ x, z, color, rot = 0 }: { x: number; z: number; color: string; rot?: number }) {
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

export const Office = memo(function Office() {
  const { x, z, w, d, h } = OFFICE
  const sign = useMemo(() => textTexture('Trycol', { fg: '#ffffff', bg: '#2563eb', w: 512, h: 128 }), [])
  const floors = [1.8, 4.6]
  return (
    <group>
      <group position={[x, 0, z]}>
        <B p={[0, h / 2, 0]} s={[w, h, d]} c={PALETTE.wall} receive outline={false} />
        <B p={[0, h + 0.25, 0]} s={[w + 0.3, 0.5, d + 0.3]} c="#e2e8f0" outline={false} />
        <B p={[0, 0.25, 0]} s={[w + 0.2, 0.5, d + 0.2]} c="#cbd5e1" outline={false} />
        {/* window bands on every facade */}
        {floors.map((y) => (
          <group key={y}>
            <mesh position={[0, y, d / 2 + 0.03]} scale={[w - 1.2, 1.3, 0.1]} geometry={BOX} material={nightGlow.window} />
            <mesh position={[0, y, -d / 2 - 0.03]} scale={[w - 1.2, 1.3, 0.1]} geometry={BOX} material={nightGlow.window} />
            <mesh position={[w / 2 + 0.03, y, 0]} scale={[0.1, 1.3, d - 1.2]} geometry={BOX} material={nightGlow.window} />
            <mesh position={[-w / 2 - 0.03, y, 0]} scale={[0.1, 1.3, d - 1.2]} geometry={BOX} material={nightGlow.window} />
          </group>
        ))}
        {/* mullions */}
        {[-4, -2, 0, 2, 4].map((mx) => (
          <B key={mx} p={[mx, 3.2, d / 2 + 0.1]} s={[0.12, 4.4, 0.08]} c={PALETTE.wall} shadow={false} outline={false} />
        ))}
        {/* entrance canopy */}
        <B p={[w / 2 + 1.2, 2.9, 1]} s={[2.4, 0.2, 3.6]} c="" material={themeMats.trim} outline={false} />
        <B p={[w / 2 + 2.25, 1.45, -0.6]} s={[0.15, 2.9, 0.15]} c={PALETTE.steel} outline={false} />
        <B p={[w / 2 + 2.25, 1.45, 2.6]} s={[0.15, 2.9, 0.15]} c={PALETTE.steel} outline={false} />
        {/* rooftop HVAC */}
        <B p={[-2.5, h + 1, -1.5]} s={[2.2, 1.1, 1.8]} c="#cbd5e1" outline={false} />
        <B p={[2, h + 0.8, 1.5]} s={[1.4, 0.7, 1.4]} c="#cbd5e1" outline={false} />
        <mesh position={[0, h - 0.6, d / 2 + 0.12]} scale={[5, 1.25, 1]}>
          <planeGeometry />
          <meshBasicMaterial map={sign} toneMapped={false} />
        </mesh>
      </group>
      {/* staff parking */}
      <mesh position={[x, 0.015, z + d / 2 + 5.5]} scale={[w + 4, 1, 8]} geometry={PLANE} material={mat('#b8c2cd', { rough: 1 })} receiveShadow />
      {[-6, -3, 0, 3, 6].map((k) => (
        <mesh key={k} position={[x + k + 1.5, 0.025, z + d / 2 + 5.5]} scale={[0.12, 1, 4.6]} geometry={PLANE} material={mat('#ffffff')} />
      ))}
      <Car x={x - 3} z={z + d / 2 + 5.5} color="#e2e8f0" />
      <Car x={x} z={z + d / 2 + 5.5} color="#3b82f6" />
      <Car x={x + 6} z={z + d / 2 + 5.5} color="#64748b" />
      <Car x={x - 6} z={z + d / 2 + 5.5} color="#f8fafc" />
    </group>
  )
})
