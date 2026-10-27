import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { useSim } from '../store/useSimStore'
import { nightGlow } from './materials'

const DAY_BG = new THREE.Color('#dce8f3')
const NIGHT_BG = new THREE.Color('#0d1726')
const DAY_SUN = new THREE.Color('#fff7ed')
const DUSK_SUN = new THREE.Color('#fdba74')
const NIGHT_SUN = new THREE.Color('#93c5fd')

/** 1 at noon-ish daylight, 0 at night, smooth transitions at dawn/dusk. */
function daylight(hour: number) {
  const s = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b)
  return s(5, 7.5, hour) * (1 - s(17.5, 20, hour))
}

/** `center`/`extent`: area that receives shadows (the sun follows it). */
export function Lighting({ center = [0, 0], extent = 75 }: { center?: [number, number]; extent?: number }) {
  const sun = useRef<THREE.DirectionalLight>(null)
  const hemi = useRef<THREE.HemisphereLight>(null)
  const scene = useThree((s) => s.scene)
  const current = useRef(1)

  // new shadow bounds only take effect after the shadow camera recomputes its projection
  useEffect(() => sun.current?.shadow.camera.updateProjectionMatrix(), [extent])

  useFrame((_, dt) => {
    const { dayNight, hour } = useSim.getState()
    const target = dayNight ? daylight(hour) : 1
    current.current += (target - current.current) * Math.min(1, dt * 2)
    const d = current.current
    if (!(scene.background instanceof THREE.Color)) scene.background = new THREE.Color()
    ;(scene.background as THREE.Color).copy(NIGHT_BG).lerp(DAY_BG, d)
    if (sun.current) {
      sun.current.target.updateMatrixWorld() // the target is not part of the scene graph
      sun.current.intensity = 0.25 + 2.35 * d
      const warm = dayNight ? 1 - Math.abs(d - 0.5) * 2 : 0
      sun.current.color.copy(NIGHT_SUN).lerp(DAY_SUN, d).lerp(DUSK_SUN, warm * 0.5)
    }
    if (hemi.current) hemi.current.intensity = 0.45 + 0.75 * d
    const night = 1 - d
    nightGlow.window.emissiveIntensity = night * 1.4
    nightGlow.lamp.emissiveIntensity = 0.2 + night * 3
    nightGlow.headlight.emissiveIntensity = 0.3 + night * 3
  })

  return (
    <>
      <hemisphereLight ref={hemi} args={['#e0f2fe', '#94a3b8', 1.2]} />
      <directionalLight
        ref={sun}
        position={[center[0] + 38, 60, center[1] + 28]}
        target-position={[center[0], 0, center[1]]}
        intensity={2.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-extent}
        shadow-camera-right={extent}
        shadow-camera-top={extent * 0.8}
        shadow-camera-bottom={-extent * 0.8}
        shadow-camera-near={1}
        shadow-camera-far={180}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
      />
    </>
  )
}
