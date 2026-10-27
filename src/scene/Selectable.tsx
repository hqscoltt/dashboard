import { forwardRef, useEffect, useState, type ReactNode } from 'react'
import type { ThreeEvent } from '@react-three/fiber'
import type * as THREE from 'three'
import type { SelectionKind } from '../data/types'
import { useSim } from '../store/useSimStore'
import { HighlightCtx } from './Part'

interface Props {
  kind: SelectionKind
  id: string
  label: string
  children: ReactNode
}

/** Wraps a model: click selects it, hover shows a tooltip + soft outline. */
export const Selectable = forwardRef<THREE.Group, Props>(function Selectable({ kind, id, label, children }, ref) {
  const selected = useSim((s) => s.selected?.kind === kind && s.selected.id === id)
  const [hover, setHover] = useState(false)

  // vehicles can leave the map while hovered: don't leave a stale tooltip behind
  useEffect(() => () => {
    const h = useSim.getState().hovered
    if (h?.kind === kind && h.id === id) {
      useSim.getState().setHovered(null)
      document.body.style.cursor = ''
    }
  }, [kind, id])

  const onClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation()
    if (e.delta > 6) return // it was a drag (pan), not a click
    useSim.getState().select({ kind, id })
  }
  const onOver = (e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation()
    setHover(true)
    useSim.getState().setHovered({ label, kind, id })
    document.body.style.cursor = 'pointer'
  }
  const onOut = () => {
    setHover(false)
    useSim.getState().setHovered(null)
    document.body.style.cursor = ''
  }

  return (
    <group ref={ref} onClick={onClick} onPointerOver={onOver} onPointerOut={onOut}>
      <HighlightCtx.Provider value={selected ? 2 : hover ? 1 : 0}>{children}</HighlightCtx.Provider>
    </group>
  )
})
