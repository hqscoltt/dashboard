// Animated building shell. Size and position ease towards the layout target every frame,
// so when data grows the walls stretch and neighbours slide away. When "entered", the roof
// lifts off and the camera-facing walls drop so the interior is visible.
import { useEffect, useMemo, useRef, type ReactNode, type RefObject } from 'react'
import { useFrame, type ThreeEvent } from '@react-three/fiber'
import * as THREE from 'three'
import { BOX, mat, nightGlow } from '../../scene/materials'
import { useUniverse } from '../store'

const DOOR_W = 3.2
const DOOR_H = 3
const LOW = 1.1
const T = 0.35 // wall thickness

function signTexture(title: string, sub: string, color: string) {
  const c = document.createElement('canvas')
  c.width = 512
  c.height = 160
  const g = c.getContext('2d')!
  g.fillStyle = '#ffffff'
  g.beginPath()
  g.roundRect(0, 0, 512, 160, 22)
  g.fill()
  g.fillStyle = color
  g.beginPath()
  g.roundRect(0, 0, 18, 160, [22, 0, 0, 22])
  g.fill()
  g.fillStyle = '#0f172a'
  g.font = '800 58px Inter, system-ui, sans-serif'
  g.textBaseline = 'middle'
  let t = title
  while (g.measureText(t).width > 460 && t.length > 4) t = t.slice(0, -2)
  g.fillText(t === title ? t : `${t}…`, 40, 58)
  g.fillStyle = '#64748b'
  g.font = '600 40px Inter, system-ui, sans-serif'
  g.fillText(sub, 40, 118)
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 4
  return tex
}

interface Props {
  id: string
  title: string
  sub: string
  windows?: boolean
  children?: ReactNode
}

export function Shell({ id, title, sub, windows, children }: Props) {
  const b = useUniverse((s) => s.layout.buildings[id])
  const inside = useUniverse((s) => s.inside === id)
  const selected = useUniverse((s) => s.selected?.kind === 'building' && s.selected.id === id)

  const group = useRef<THREE.Group>(null)
  const m = {
    floor: useRef<THREE.Mesh>(null), back: useRef<THREE.Mesh>(null), left: useRef<THREE.Mesh>(null),
    right: useRef<THREE.Mesh>(null), fl: useRef<THREE.Mesh>(null), fr: useRef<THREE.Mesh>(null),
    lintel: useRef<THREE.Mesh>(null), roof: useRef<THREE.Mesh>(null), stripe: useRef<THREE.Mesh>(null),
    sign: useRef<THREE.Mesh>(null), frame: useRef<THREE.Group>(null),
    win2: useRef<THREE.Mesh>(null), winR: useRef<THREE.Mesh>(null),
  }
  const cur = useRef({ x: b?.x ?? 0, z: b?.z ?? 0, w: b?.w ?? 8, d: b?.d ?? 7, open: 0 })
  const roofMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#e2e8f0', roughness: 0.8, flatShading: true, transparent: true }), [])
  const stripeMat = useMemo(() => new THREE.MeshStandardMaterial({ color: b?.color ?? '#2563eb', roughness: 0.7, flatShading: true }), [b?.color])
  const tex = useMemo(() => signTexture(title, sub, b?.color ?? '#2563eb'), [title, sub, b?.color])
  useEffect(() => () => tex.dispose(), [tex])

  useFrame((_, dt) => {
    if (!b || !group.current) return
    const c = cur.current
    const k = 1 - Math.exp(-dt * 3.2)
    c.x += (b.x - c.x) * k
    c.z += (b.z - c.z) * k
    c.w += (b.w - c.w) * k
    c.d += (b.d - c.d) * k
    c.open += ((inside ? 1 : 0) - c.open) * Math.min(1, dt * 3)
    const { w, d } = c
    const H = b.h
    const fh = H - (H - LOW) * c.open
    group.current.position.set(c.x, 0, c.z)

    const set = (r: RefObject<THREE.Mesh | null>, px: number, py: number, pz: number, sx: number, sy: number, sz: number) => {
      const o = r.current
      if (!o) return
      o.position.set(px, py, pz)
      o.scale.set(Math.max(0.001, sx), Math.max(0.001, sy), Math.max(0.001, sz))
    }
    set(m.floor, w / 2, 0.06, -d / 2, w, 0.12, d)
    set(m.back, w / 2, H / 2, -d, w + T, H, T)
    set(m.left, 0, H / 2, -d / 2, T, H, d)
    set(m.right, w, fh / 2, -d / 2, T, fh, d)
    const side = w / 2 - DOOR_W / 2
    set(m.fl, side / 2, fh / 2, 0, side, fh, T)
    set(m.fr, w - side / 2, fh / 2, 0, side, fh, T)
    m.lintel.current!.visible = fh > DOOR_H + 0.05
    set(m.lintel, w / 2, (DOOR_H + fh) / 2, 0, DOOR_W, fh - DOOR_H, T)
    set(m.stripe, w / 2, Math.max(LOW, fh) - 0.32, 0.2, w + T, 0.5, 0.08)
    set(m.roof, w / 2, H + 0.2 + c.open * 8, -d / 2, w + 0.7, 0.4, d + 0.7)
    roofMat.opacity = 1 - c.open
    m.roof.current!.visible = c.open < 0.97
    const signY = Math.max(fh, DOOR_H) + 1.15
    set(m.sign, w / 2, signY, 0.32, Math.min(7, w - 1), Math.min(7, w - 1) * 0.3125, 1)
    if (windows) {
      set(m.win2, w / 2, 6, 0.2, w - 2, 1.1, 0.08)
      set(m.winR, w + 0.2, 6, -d / 2, 0.08, 1.1, d - 2)
      m.win2.current!.visible = fh > 6.8
      m.winR.current!.visible = fh > 6.8
    }
    const f = m.frame.current
    if (f) {
      f.visible = selected
      const [top, bottom, l, r] = f.children as THREE.Mesh[]
      top.position.set(w / 2, 0.16, -d - 0.6); top.scale.set(w + 1.4, 0.12, 0.25)
      bottom.position.set(w / 2, 0.16, 0.6); bottom.scale.set(w + 1.4, 0.12, 0.25)
      l.position.set(-0.6, 0.16, -d / 2); l.scale.set(0.25, 0.12, d + 1.4)
      r.position.set(w + 0.6, 0.16, -d / 2); r.scale.set(0.25, 0.12, d + 1.4)
    }
  })

  if (!b) return null
  const wall = mat('#f8fafc')
  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6) return
    useUniverse.getState().select({ kind: 'building', id })
  }
  const onDouble = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    useUniverse.getState().enter(id)
  }
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    useUniverse.getState().setHovered({ label: title, sub: `${sub} · clique duplo para entrar` })
    document.body.style.cursor = 'pointer'
  }
  const onOut = () => {
    useUniverse.getState().setHovered(null)
    document.body.style.cursor = ''
  }
  const glow = mat('#22d3ee', { emissive: '#22d3ee', ei: 0.8 })

  return (
    <group ref={group} position={[b.x, 0, b.z]}>
      <group onClick={onClick} onDoubleClick={onDouble} onPointerOver={onOver} onPointerOut={onOut}>
        <mesh ref={m.floor} geometry={BOX} material={mat('#eef2f6', { rough: 1 })} receiveShadow />
        <mesh ref={m.back} geometry={BOX} material={wall} castShadow receiveShadow />
        <mesh ref={m.left} geometry={BOX} material={wall} castShadow receiveShadow />
        <mesh ref={m.right} geometry={BOX} material={wall} castShadow receiveShadow />
        <mesh ref={m.fl} geometry={BOX} material={wall} castShadow receiveShadow />
        <mesh ref={m.fr} geometry={BOX} material={wall} castShadow receiveShadow />
        <mesh ref={m.lintel} geometry={BOX} material={wall} castShadow />
        <mesh ref={m.stripe} geometry={BOX} material={stripeMat} />
        <mesh ref={m.roof} geometry={BOX} material={roofMat} castShadow />
        <mesh ref={m.sign}>
          <planeGeometry />
          <meshBasicMaterial map={tex} toneMapped={false} />
        </mesh>
        {windows && (
          <>
            <mesh ref={m.win2} geometry={BOX} material={nightGlow.window} />
            <mesh ref={m.winR} geometry={BOX} material={nightGlow.window} />
          </>
        )}
      </group>
      <group ref={m.frame} visible={false}>
        {[0, 1, 2, 3].map((i) => <mesh key={i} geometry={BOX} material={glow} raycast={() => null} />)}
      </group>
      {children}
    </group>
  )
}
