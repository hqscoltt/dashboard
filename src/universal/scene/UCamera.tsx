import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MapControls, OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'
import type { MapControls as MapControlsImpl } from 'three-stdlib'
import { useUniverse } from '../store'

const ELEVATION = Math.atan(1 / Math.SQRT2)
const DISTANCE = 220
const MIN_ZOOM = 2
const MAX_ZOOM = 70

function offsetFor(az: number) {
  return new THREE.Vector3(
    Math.cos(ELEVATION) * Math.sin(az) * DISTANCE,
    Math.sin(ELEVATION) * DISTANCE,
    Math.cos(ELEVATION) * Math.cos(az) * DISTANCE,
  )
}

/** Frames the whole generated city. */
function home(size: { width: number; height: number }) {
  const b = useUniverse.getState().layout.bounds
  const w = b.maxX - b.minX
  const d = b.maxZ - b.minZ
  // iso projection: screen width ≈ (w + d) * cos45, height ≈ (w + d) * 0.41
  const zoom = Math.min(size.width / ((w + d) * 0.72), size.height / ((w + d) * 0.42)) * 1.35
  return { target: new THREE.Vector3((b.minX + b.maxX) / 2, 0, (b.minZ + b.maxZ) / 2), zoom: Math.max(MIN_ZOOM, Math.min(16, zoom)) }
}

export function UCamera() {
  const camera = useRef<THREE.OrthographicCamera>(null)
  const controls = useRef<MapControlsImpl>(null)
  const size = useThree((s) => s.size)
  const az = useRef({ cur: Math.PI / 4, goal: Math.PI / 4 })
  const zoomGoal = useRef<number | null>(null)
  const targetGoal = useRef<THREE.Vector3 | null>(null)

  useEffect(() => {
    const cam = camera.current!
    const h = home(size)
    cam.zoom = h.zoom
    cam.position.copy(h.target).add(offsetFor(az.current.cur))
    cam.updateProjectionMatrix()
    controls.current?.target.copy(h.target)
    controls.current?.update()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(
    () =>
      useUniverse.subscribe((s, prev) => {
        const cmd = s.camera
        if (!cmd || cmd === prev.camera || !camera.current) return
        const z = zoomGoal.current ?? camera.current.zoom
        switch (cmd.type) {
          case 'zoomIn': zoomGoal.current = Math.min(MAX_ZOOM, z * 1.35); break
          case 'zoomOut': zoomGoal.current = Math.max(MIN_ZOOM, z / 1.35); break
          case 'rotateLeft': az.current.goal -= Math.PI / 2; break
          case 'rotateRight': az.current.goal += Math.PI / 2; break
          case 'reset': {
            const h = home(size)
            zoomGoal.current = h.zoom
            targetGoal.current = h.target
            az.current.goal = Math.round((az.current.goal - Math.PI / 4) / (Math.PI * 2)) * Math.PI * 2 + Math.PI / 4
            break
          }
          case 'focus':
            targetGoal.current = new THREE.Vector3(cmd.x, 0, cmd.z)
            zoomGoal.current = cmd.zoom ?? Math.max(z, 14)
            break
        }
      }),
    [size],
  )

  useFrame((_, dt) => {
    const cam = camera.current
    const ctl = controls.current
    if (!cam || !ctl) return
    const k = 1 - Math.exp(-dt * 5)
    let moved = false
    if (zoomGoal.current !== null) {
      cam.zoom += (zoomGoal.current - cam.zoom) * k
      if (Math.abs(zoomGoal.current - cam.zoom) < 0.01) { cam.zoom = zoomGoal.current; zoomGoal.current = null }
      cam.updateProjectionMatrix()
      moved = true
    }
    if (targetGoal.current) {
      ctl.target.lerp(targetGoal.current, k)
      if (ctl.target.distanceTo(targetGoal.current) < 0.02) targetGoal.current = null
      moved = true
    }
    const a = az.current
    // the user may have orbited with the right mouse button: adopt the camera's current azimuth
    if (Math.abs(a.goal - a.cur) <= 1e-4) {
      const real = Math.atan2(cam.position.x - ctl.target.x, cam.position.z - ctl.target.z)
      a.cur = a.goal = a.cur + (((real - a.cur + Math.PI) % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2) - Math.PI
    }
    if (Math.abs(a.goal - a.cur) > 1e-4 || moved) {
      a.cur += (a.goal - a.cur) * k
      if (Math.abs(a.goal - a.cur) < 1e-4) a.cur = a.goal
      cam.position.copy(ctl.target).add(offsetFor(a.cur))
      cam.lookAt(ctl.target)
      ctl.update()
    }
  })

  return (
    <>
      <OrthographicCamera ref={camera} makeDefault near={-300} far={800} />
      <MapControls
        ref={controls}
        makeDefault
        // left = pan, right = orbit around (azimuth only: the iso tilt stays fixed)
        enableRotate
        mouseButtons={{ LEFT: THREE.MOUSE.PAN, MIDDLE: THREE.MOUSE.DOLLY, RIGHT: THREE.MOUSE.ROTATE }}
        minPolarAngle={Math.PI / 2 - ELEVATION}
        maxPolarAngle={Math.PI / 2 - ELEVATION}
        rotateSpeed={0.6}
        enableDamping
        dampingFactor={0.12}
        zoomToCursor
        minZoom={MIN_ZOOM}
        maxZoom={MAX_ZOOM}
        onStart={() => { targetGoal.current = null; zoomGoal.current = null }}
      />
    </>
  )
}
