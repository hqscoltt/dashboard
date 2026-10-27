import { useEffect } from 'react'
import { useSim } from '../store/useSimStore'
import { engine } from './engine'

/** (Re)loads the simulation whenever the selected warehouse changes. */
export function useSimulation() {
  const warehouseId = useSim((s) => s.warehouseId)
  useEffect(() => {
    void engine.load(warehouseId)
  }, [warehouseId])
}
