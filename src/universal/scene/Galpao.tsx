// Open (cut-away) warehouse in the same style as the logistics yard: tall back/left walls,
// low front/right walls, steel skeleton, a dock door with roll-up door and sign, pallet racks
// and a forklift. Size eases towards the layout target, so warehouses visibly expand.
import { memo, useEffect, useLayoutEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { ForkliftModel } from '../../scene/Forklift'
import { BOX, CYL, PALETTE, PLANE, mat, nightGlow } from '../../scene/materials'
import { doorWanted, fleet, forkHomes } from '../fleet'
import { BAY, LEVELS, rackPlan, rowZ, type BLayout } from '../layout'
import { useUniverse } from '../store'

const LOW = 1.3
const PART = 1.9 // internal partition height between sections
const DOOR_W = 3.4
const DOOR_H = 4

function signTexture(title: string, sub: string, color: string) {
  const c = document.createElement('canvas')
  c.width = 640
  c.height = 176
  const g = c.getContext('2d')!
  g.fillStyle = color
  g.beginPath()
  g.roundRect(0, 0, 640, 176, 20)
  g.fill()
  g.fillStyle = '#ffffff'
  g.textBaseline = 'middle'
  let size = 70
  g.font = `800 ${size}px Inter, system-ui, sans-serif`
  const t = title.toUpperCase()
  while (g.measureText(t).width > 590 && size > 34) { size -= 4; g.font = `800 ${size}px Inter, system-ui, sans-serif` }
  g.fillText(t, 26, 66)
  g.globalAlpha = 0.85
  g.font = '600 40px Inter, system-ui, sans-serif'
  g.fillText(sub, 26, 136)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

/** Racks for `bays` × `rows` (frames only; pallets are drawn by the caller). */
const RackFrames = memo(function RackFrames({ bays, rows }: { bays: number; rows: number }) {
  const posts = useRef<THREE.InstancedMesh>(null)
  const beams = useRef<THREE.InstancedMesh>(null)
  const { p, b } = useMemo(() => {
    const p: [number, number][] = []
    const b: [number, number, number, number][] = []
    const plan = rackPlan(bays)
    for (let r = 0; r < rows; r++) {
      const z = rowZ(r)
      for (const run of plan.runs) {
        for (let i = 0; i <= run.bays; i++) for (const s of [-0.6, 0.6]) p.push([run.x0 + i * BAY, z + s])
        const len = run.bays * BAY
        for (const y of [1.55, 3.05, 4.5]) for (const s of [-0.6, 0.6]) b.push([run.x0 + len / 2, y, z + s, len])
      }
    }
    return { p, b }
  }, [bays, rows])
  useLayoutEffect(() => {
    const m = new THREE.Matrix4()
    const q = new THREE.Quaternion()
    p.forEach(([x, z], i) => posts.current!.setMatrixAt(i, m.compose(new THREE.Vector3(x, 2.3, z), q, new THREE.Vector3(0.12, 4.6, 0.12))))
    b.forEach(([x, y, z, l], i) => beams.current!.setMatrixAt(i, m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(l, 0.14, 0.09))))
    posts.current!.instanceMatrix.needsUpdate = true
    beams.current!.instanceMatrix.needsUpdate = true
    posts.current!.computeBoundingSphere()
    beams.current!.computeBoundingSphere()
  }, [p, b])
  return (
    <>
      <instancedMesh key={`p${p.length}`} ref={posts} args={[BOX, mat(PALETTE.rackUpright, { metal: 0.3, rough: 0.5 }), p.length]} castShadow />
      <instancedMesh key={`b${b.length}`} ref={beams} args={[BOX, mat(PALETTE.rackBeam, { metal: 0.2, rough: 0.55 }), b.length]} castShadow />
      {Array.from({ length: rows }, (_, r) =>
        rackPlan(bays).runs.map((run) => (
          <mesh key={`${r}-${run.x0}`} position={[run.x0 + (run.bays * BAY) / 2, 0.075, rowZ(r) + 1.05]} scale={[run.bays * BAY + 0.4, 1, 0.12]} geometry={PLANE} material={mat(PALETTE.yellow, { rough: 1 })} />
        )),
      )}
    </>
  )
})

/** The warehouse forklift, driven by fleet.ts (local coordinates). */
function WarehouseForklift({ id, index, b }: { id: string; index: number; b: BLayout }) {
  const root = useRef<THREE.Group>(null)
  const carriage = useRef<THREE.Group>(null)
  const inner = useRef<THREE.Group>(null)
  const load = useRef<THREE.Group>(null)
  const wheels = useRef<THREE.Group>(null)
  const loadMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d6b48a', roughness: 0.85, flatShading: true }), [])
  const beacon = useMemo(() => new THREE.MeshStandardMaterial({ color: '#fbbf24', emissive: '#f59e0b', emissiveIntensity: 0 }), [])
  useFrame(({ clock }) => {
    const f = fleet.forks.get(id)?.[index]
    const g = root.current
    if (!g) return
    if (!f) {
      const h = forkHomes(b)[index] ?? { x: b.w - 1.9, z: -2.2 }
      g.position.set(h.x, 0, h.z)
      g.rotation.y = -Math.PI / 2
      return
    }
    g.position.set(f.x, 0, f.z)
    g.rotation.y = f.heading
    carriage.current!.position.y = f.forkY
    inner.current!.position.y = Math.max(0, f.forkY - 0.9)
    load.current!.visible = !!f.carrying
    if (f.carrying) loadMat.color.set(f.carrying)
    for (const w of wheels.current!.children) w.rotation.x = f.odometer / 0.3
    beacon.emissiveIntensity = f.path.length || f.steps.length ? (Math.sin(clock.elapsedTime * 10) > 0 ? 2 : 0.2) : 0
  })
  return (
    <group ref={root} scale={1}>
      <ForkliftModel carriage={carriage} inner={inner} load={load} wheels={wheels} loadMat={loadMat} beacon={beacon} />
    </group>
  )
}

interface Props {
  id: string
  title: string
  sub: string
  children?: ReactNode
}

export function Galpao({ id, title, sub, children }: Props) {
  const b = useUniverse((s) => s.layout.buildings[id])
  const color = b?.color ?? '#2563eb'
  const H = b?.h ?? 7

  const group = useRef<THREE.Group>(null)
  const r = {
    slab: useRef<THREE.Mesh>(null), back: useRef<THREE.Mesh>(null), left: useRef<THREE.Mesh>(null),
    backTrim: useRef<THREE.Mesh>(null), leftTrim: useRef<THREE.Mesh>(null), right: useRef<THREE.Mesh>(null),
    fl: useRef<THREE.Mesh>(null), fr: useRef<THREE.Mesh>(null), colFR: useRef<THREE.Mesh>(null),
    colBR: useRef<THREE.Mesh>(null), beamF: useRef<THREE.Mesh>(null), beamR: useRef<THREE.Mesh>(null),
    dock: useRef<THREE.Group>(null), door: useRef<THREE.Mesh>(null), trusses: useRef<THREE.Group>(null),
    frame: useRef<THREE.Group>(null), win: useRef<THREE.Group>(null), apron: useRef<THREE.Group>(null),
  }
  const cur = useRef({ x: b?.x ?? 0, z: b?.z ?? 0, w: b?.w ?? 14, d: b?.d ?? 12, door: 0 })
  const tex = useMemo(() => signTexture(title, sub, color), [title, sub, color])
  useEffect(() => () => tex.dispose(), [tex])
  const accent = useMemo(() => new THREE.MeshStandardMaterial({ color, roughness: 0.7, flatShading: true }), [color])
  const light = useMemo(() => new THREE.MeshStandardMaterial({ color: '#22c55e', emissive: '#22c55e', emissiveIntensity: 1.2 }), [])

  useFrame((_, dt) => {
    if (!b || !group.current) return
    const c = cur.current
    const k = 1 - Math.exp(-dt * 3)
    c.x += (b.x - c.x) * k
    c.z += (b.z - c.z) * k
    c.w += (b.w - c.w) * k
    c.d += (b.d - c.d) * k
    const want = doorWanted(id)
    c.door += (want - c.door) * Math.min(1, dt * 2)
    const { w, d } = c
    group.current.position.set(c.x, 0, c.z)
    const set = (m: RefObject<THREE.Mesh | null>, px: number, py: number, pz: number, sx: number, sy: number, sz: number) => {
      if (!m.current) return
      m.current.position.set(px, py, pz)
      m.current.scale.set(Math.max(0.001, sx), Math.max(0.001, sy), Math.max(0.001, sz))
    }
    // neighbouring sections share walls: no overlapping (coplanar) pieces at the seams
    const eL = b.joinL ? 0 : 0.19
    const eR = b.joinR ? 0 : 0.19
    set(r.slab, w / 2, 0.03, -d / 2, w, 0.06, d)
    set(r.back, (w + eR - eL) / 2, H / 2, -d, w + eL + eR, H, 0.4)
    set(r.backTrim, (w + eR - eL) / 2, H - 0.38, -d + 0.01, w + eL + eR + (b.joinL || b.joinR ? 0 : 0.08), 0.8, 0.44)
    if (b.joinL) {
      // internal partition between two stages: low so the inside stays visible
      set(r.left, 0, PART / 2, -d / 2 - 0.2, 0.3, PART, d - 0.4)
      set(r.leftTrim, 0, PART + 0.06, -d / 2 - 0.2, 0.36, 0.12, d - 0.4)
    } else {
      set(r.left, 0, H / 2, -d / 2, 0.4, H, d)
      set(r.leftTrim, 0.01, H - 0.385, -d / 2, 0.44, 0.79, d)
    }
    set(r.right, w, LOW / 2, -d / 2, 0.4, b.joinR ? 0 : LOW, d - 0.4)
    const side = w / 2 - DOOR_W / 2 - 0.5
    set(r.fl, side / 2, (LOW + 0.03) / 2, 0, side, LOW + 0.03, 0.42)
    set(r.fr, w - side / 2, (LOW + 0.03) / 2, 0, side, LOW + 0.03, 0.42)
    set(r.colFR, w, (H + 0.05) / 2, 0, 0.5, H + 0.05, 0.5)
    set(r.colBR, w, (H + 0.05) / 2, -d, 0.5, H + 0.05, 0.5)
    set(r.beamF, w / 2, H, 0, w, 0.3, 0.3)
    set(r.beamR, w, H, -d / 2, 0.3, 0.3, d)
    r.dock.current?.position.set(w / 2, 0, 0)
    r.apron.current?.position.set(w / 2, 0, 0)
    if (r.door.current) {
      const h = Math.max(0.18, DOOR_H * (1 - c.door))
      r.door.current.scale.y = h
      r.door.current.position.y = DOOR_H - h / 2
      const busy = fleet.docks.has(id)
      light.color.set(busy ? (c.door > 0.5 ? '#ef4444' : '#f59e0b') : '#22c55e')
      light.emissive.copy(light.color)
    }
    // roof trusses every ~8 m
    const tr = r.trusses.current
    if (tr) tr.children.forEach((m, i) => {
      const n = Math.max(2, Math.round(w / 8))
      m.visible = i <= n && !(b.joinL && i === 0) // the left neighbour already has a truss there
      m.position.set((w / n) * i, H + 0.1, -d / 2)
      m.scale.set(0.2, 0.2, d)
    })
    const wn = r.win.current
    if (wn) wn.children.forEach((m, i) => {
      const n = Math.max(1, Math.floor(d / 6))
      m.visible = i < n && !b.joinL // windows only on real outer walls
      m.position.set(0.22, H * 0.66, -(d / n) * (i + 0.5))
      m.scale.set(0.05, 1.2, Math.max(0.5, d / n - 1.6))
    })
  })

  if (!b) return null
  const wall = mat(PALETTE.wall)
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6) return
    useUniverse.getState().select({ kind: 'building', id })
  }
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    useUniverse.getState().setHovered({ label: title, sub })
    document.body.style.cursor = 'pointer'
  }
  const onOut = () => {
    useUniverse.getState().setHovered(null)
    document.body.style.cursor = ''
  }
  const fw = DOOR_W / 2

  return (
    <group ref={group} position={[b.x, 0, b.z]}>
      <group onClick={onClick} onPointerOver={onOver} onPointerOut={onOut}>
        <mesh ref={r.slab} geometry={BOX} material={mat(PALETTE.floor)} receiveShadow />
        <mesh ref={r.back} geometry={BOX} material={wall} receiveShadow castShadow />
        <mesh ref={r.left} geometry={BOX} material={wall} receiveShadow castShadow />
        <mesh ref={r.backTrim} geometry={BOX} material={accent} />
        <mesh ref={r.leftTrim} geometry={BOX} material={accent} />
        <mesh ref={r.right} geometry={BOX} material={wall} castShadow />
        <mesh ref={r.fl} geometry={BOX} material={wall} castShadow />
        <mesh ref={r.fr} geometry={BOX} material={wall} castShadow />
        <mesh ref={r.colFR} geometry={BOX} material={mat(PALETTE.steel)} castShadow />
        <mesh ref={r.colBR} geometry={BOX} material={mat(PALETTE.steel)} castShadow />
        <mesh ref={r.beamF} geometry={BOX} material={mat(PALETTE.steel)} />
        <mesh ref={r.beamR} geometry={BOX} material={mat(PALETTE.steel)} />
        <group ref={r.trusses}>
          {Array.from({ length: 12 }, (_, i) => <mesh key={i} geometry={BOX} material={mat(PALETTE.steel)} />)}
        </group>
        <group ref={r.win}>
          {Array.from({ length: 10 }, (_, i) => <mesh key={i} geometry={BOX} material={nightGlow.window} />)}
        </group>
        {/* dock: frame, roll-up door, bumpers, sign and status light */}
        <group ref={r.dock}>
          <mesh position={[-fw - 0.25, (DOOR_H + 0.5) / 2, 0]} scale={[0.46, DOOR_H + 0.5, 0.46]} geometry={BOX} material={wall} castShadow />
          <mesh position={[fw + 0.25, (DOOR_H + 0.5) / 2, 0]} scale={[0.46, DOOR_H + 0.5, 0.46]} geometry={BOX} material={wall} castShadow />
          <mesh position={[0, DOOR_H + 0.35, 0]} scale={[DOOR_W + 1.06, 0.5, 0.54]} geometry={BOX} material={accent} castShadow />
          <mesh ref={r.door} position={[0, DOOR_H / 2, 0.02]} scale={[DOOR_W - 0.1, DOOR_H, 0.1]} geometry={BOX} material={mat('#e2e8f0', { rough: 0.6 })} castShadow />
          <mesh position={[0, DOOR_H - 0.1, -0.15]} rotation={[0, 0, Math.PI / 2]} scale={[0.4, DOOR_W, 0.4]} geometry={CYL} material={mat(PALETTE.darkSteel)} />
          <mesh position={[-1.3, 1.05, 0.35]} scale={[0.35, 0.5, 0.3]} geometry={BOX} material={mat('#111827')} />
          <mesh position={[1.3, 1.05, 0.35]} scale={[0.35, 0.5, 0.3]} geometry={BOX} material={mat('#111827')} />
          <mesh position={[0, 0.07, -0.9]} scale={[DOOR_W - 0.4, 0.08, 1.6]} geometry={BOX} material={mat('#9ca3af')} receiveShadow />
          <mesh position={[0, DOOR_H + 1.4, 0.26]} scale={[4.6, 1.27, 1]}>
            <planeGeometry />
            <meshBasicMaterial map={tex} toneMapped={false} />
          </mesh>
          <mesh position={[0, DOOR_H + 1.4, 0.19]} scale={[4.75, 1.4, 0.1]} geometry={BOX} material={mat('#e2e8f0')} />
          <mesh position={[fw + 0.25, DOOR_H + 0.2, 0.33]} scale={[0.32, 0.32, 0.2]} geometry={BOX} material={light} />
        </group>
      </group>
      {/* yard markings in front of the dock */}
      <group ref={r.apron}>
        <mesh position={[-fw - 0.2, 0.025, 6]} scale={[0.18, 1, 11.5]} geometry={PLANE} material={mat(PALETTE.yellow)} />
        <mesh position={[fw + 0.2, 0.025, 6]} scale={[0.18, 1, 11.5]} geometry={PLANE} material={mat(PALETTE.yellow)} />
        <mesh position={[0, 0.025, 11.7]} scale={[DOOR_W + 0.6, 1, 0.25]} geometry={PLANE} material={mat('#ffffff')} />
      </group>
      <RackFrames bays={b.bays} rows={b.rows} />
      {children}
      {forkHomes(b).map((_, i) => <WarehouseForklift key={i} id={id} index={i} b={b} />)}
    </group>
  )
}

/** Unused helper kept for stock rows: number of pallets a rack row holds. */
export const ROW_CAPACITY = (bays: number) => bays * LEVELS
