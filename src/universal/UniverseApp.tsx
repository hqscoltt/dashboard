import { DataPanel } from './hud/DataPanel'
import { InsideBanner, UCameraButtons, UDetail, UFunnel, UKpis, UList, UTooltip } from './hud/UPanels'
import { UTopBar } from './hud/UTopBar'
import { UScene } from './scene/UScene'
import { useUniverseDriver } from './sources'

/** Universal dashboard: any data + mapping → generated 3D city. */
export default function UniverseApp() {
  useUniverseDriver()
  return (
    <div className="relative h-full w-full min-w-[1100px] select-none font-sans text-slate-800">
      <UScene />
      <div className="pointer-events-none absolute inset-0">
        <UTopBar />
        <UKpis />
        <UCameraButtons />
        <UDetail />
        <UFunnel />
        <UList />
        <InsideBanner />
      </div>
      <UTooltip />
      <DataPanel />
    </div>
  )
}
