import { CameraControls } from './components/CameraControls'
import { DetailPanel } from './components/DetailPanel'
import { FollowBadge } from './components/FollowBadge'
import { KpiCards } from './components/KpiCards'
import { ShipmentTracking } from './components/ShipmentTracking'
import { StatusPanel } from './components/StatusPanel'
import { Tooltip } from './components/Tooltip'
import { TopBar } from './components/TopBar'
import { Scene } from './scene/Scene'
import { useSimulation } from './simulation/useSimulation'
import { WAREHOUSES } from './data/mockData'
import { useApp } from './store/useApp'
import { useSim } from './store/useSimStore'
import UniverseApp from './universal/UniverseApp'

function LoadingOverlay() {
  const loading = useSim((s) => s.loading)
  const id = useSim((s) => s.warehouseId)
  if (!loading) return null
  const w = WAREHOUSES.find((x) => x.id === id)
  return (
    <div className="absolute inset-0 z-40 grid place-items-center bg-white/40 backdrop-blur-sm">
      <div className="glass flex items-center gap-3 px-5 py-3 text-sm font-semibold text-slate-700">
        <span className="h-4 w-4 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
        Carregando {w ? `${w.name} · ${w.city}` : 'armazém'}…
      </div>
    </div>
  )
}

function LogisticsApp() {
  useSimulation()
  return (
    <div className="relative h-full w-full min-w-[1100px] select-none font-sans text-slate-800">
      <Scene />
      {/* HUD layer: transparent to the pointer except on panels */}
      <div className="pointer-events-none absolute inset-0">
        <TopBar />
        <KpiCards />
        <CameraControls />
        <DetailPanel />
        <ShipmentTracking />
        <StatusPanel />
        <FollowBadge />
      </div>
      <Tooltip />
      <LoadingOverlay />
    </div>
  )
}

export default function App() {
  const mode = useApp((s) => s.mode)
  return mode === 'logistica' ? <LogisticsApp /> : <UniverseApp />
}
