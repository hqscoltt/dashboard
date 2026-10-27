// Isometric orthographic camera: drag = pan, wheel = zoom, HUD buttons = zoom/rotate/reset/focus.
import { useEffect, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { MapControls, OrthographicCamera } from '@react-three/drei'
import * as THREE from 'three'
import type { MapControls as MapControlsImpl } from 'three-stdlib'
import { engine } from '../simulation/engine'
import { useSim } from '../store/useSimStore'

const ELEVATION = Math.atan(1 / Math.SQRT2) // true isometric angle (~35.26°)
const DISTANCE = 160
const HOME_TARGET = new THREE.Vector3(-2, 0, 4)
const MIN_ZOOM = 3
const MAX_ZOOM = 60

function offsetFor(az: number) {
  return new THREE.Vector3(
    Math.cos(ELEVATION) * Math.sin(az) * DISTANCE,
    Math.sin(ELEVATION) * DISTANCE,
    Math.cos(ELEVATION) * Math.cos(az) * DISTANCE,
  )
}

export function CameraRig() {
  const camera = useRef<THREE.OrthographicCamera>(null)
  const controls = useRef<MapControlsImpl>(null)
  const size = useThree((s) => s.size)
  const dom = useThree((s) => s.gl.domElement)
  const homeZoom = Math.max(4, Math.min(size.width / 100, size.height / 62))

  const az = useRef({ cur: Math.PI / 4, goal: Math.PI / 4 })
  const zoomGoal = useRef<number | null>(null)
  const targetGoal = useRef<THREE.Vector3 | null>(null)

  // initial framing
  useEffect(() => {
    const cam = camera.current!
    cam.zoom = homeZoom
    cam.position.copy(HOME_TARGET).add(offsetFor(az.current.cur))
    cam.updateProjectionMatrix()
    controls.current?.target.copy(HOME_TARGET)
    controls.current?.update()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // HUD commands
  useEffect(
    () =>
      useSim.subscribe((s, prev) => {
        // picking something else (or nothing) releases the camera
        const f = s.following
        if (f && s.selected !== prev.selected && (s.selected?.kind !== f.kind || s.selected?.id !== f.id)) {
          useSim.setState({ following: null })
        }
        const cmd = s.camera
        if (!cmd || cmd === prev.camera || !camera.current) return
        const z = zoomGoal.current ?? camera.current.zoom
        switch (cmd.type) {
          case 'zoomIn': zoomGoal.current = Math.min(MAX_ZOOM, z * 1.35); break
          case 'zoomOut': zoomGoal.current = Math.max(MIN_ZOOM, z / 1.35); break
          case 'rotateLeft': az.current.goal -= Math.PI / 2; break
          case 'rotateRight': az.current.goal += Math.PI / 2; break
          case 'reset':
            zoomGoal.current = homeZoom
            targetGoal.current = HOME_TARGET.clone()
            useSim.setState({ following: null })
            az.current.goal = Math.round((az.current.goal - Math.PI / 4) / (Math.PI * 2)) * Math.PI * 2 + Math.PI / 4
            break
          case 'focus':
            targetGoal.current = cmd.follow ? null : new THREE.Vector3(cmd.x, 0, cmd.z)
            zoomGoal.current = Math.max(z, homeZoom * 1.9)
            useSim.setState({ following: cmd.follow ?? null })
            break
        }
      }),
    [homeZoom],
  )

  // Dragging the map (pan) releases the camera from the followed object; wheel zoom does not.
  useEffect(() => {
    let start: { x: number; y: number } | null = null
    const down = (e: PointerEvent) => (start = { x: e.clientX, y: e.clientY })
    const move = (e: PointerEvent) => {
      if (start && e.buttons && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 5 && useSim.getState().following) {
        useSim.setState({ following: null })
      }
    }
    const up = () => (start = null)
    dom.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => {
      dom.removeEventListener('pointerdown', down)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
    }
  }, [dom])

  const followPoint = useRef(new THREE.Vector3())

  useFrame((_, dt) => {
    const cam = camera.current
    const ctl = controls.current
    if (!cam || !ctl) return
    const k = 1 - Math.exp(-dt * 6)
    let moved = false

    if (zoomGoal.current !== null) {
      cam.zoom += (zoomGoal.current - cam.zoom) * k
      if (Math.abs(zoomGoal.current - cam.zoom) < 0.01) { cam.zoom = zoomGoal.current; zoomGoal.current = null }
      cam.updateProjectionMatrix()
      moved = true
    }
    const follow = useSim.getState().following
    ctl.zoomToCursor = !follow // zooming keeps the followed object centered
    if (follow) {
      const p = engine.positionOf(follow)
      if (!p) {
        useSim.setState({ following: null }) // e.g. the truck left the map
      } else {
        ctl.target.lerp(followPoint.current.set(p.x, 0, p.z), 1 - Math.exp(-dt * 5))
        moved = true
      }
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
      <OrthographicCamera ref={camera} makeDefault near={-200} far={600} />
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
