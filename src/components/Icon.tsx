// Tiny inline icon set (stroke icons, 24x24) — no external icon font or assets.
const PATHS = {
  search: 'M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm10 2-4.35-4.35',
  truck: 'M3 6h11v10H3zM14 9h4l3 3v4h-7M7.5 19.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm10 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  forklift: 'M4 18V9h6l2 5v4M10 9V5H6v4M16 3v15h5M16 15h5M7 20.5a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3zm7 0a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3z',
  box: 'M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8',
  dock: 'M3 21V8l9-5 9 5v13M7 21v-8h10v8M7 17h10',
  site: 'M3 21h18M5 21V10l7-5 7 5v11M9 21v-6h6v6',
  play: 'M7 4l13 8-13 8z',
  pause: 'M7 4h3v16H7zM14 4h3v16h-3z',
  sun: 'M12 17a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4',
  moon: 'M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8z',
  plus: 'M12 5v14M5 12h14',
  minus: 'M5 12h14',
  rotL: 'M3 12a9 9 0 1 0 3-6.7L3 8M3 3v5h5',
  rotR: 'M21 12a9 9 0 1 1-3-6.7L21 8M21 3v5h-5',
  home: 'M3 11l9-8 9 8M5 9v12h14V9',
  x: 'M18 6 6 18M6 6l12 12',
  chevron: 'M6 9l6 6 6-6',
  check: 'M5 12l5 5L20 7',
  target: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zm0-5a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm0-14v3m0 14v3M2 12h3m14 0h3',
  arrowUp: 'M12 19V5M5 12l7-7 7 7',
  arrowDown: 'M12 5v14M19 12l-7 7-7-7',
  battery: 'M3 7h15v10H3zM21 10v4',
  bell: 'M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 0 1-3.4 0',
  pin: 'M12 22s7-6.5 7-12a7 7 0 1 0-14 0c0 5.5 7 12 7 12zm0-9a3 3 0 1 0 0-6 3 3 0 0 0 0 6z',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, className = 'h-4 w-4', strokeWidth = 2 }: { name: IconName; className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  )
}
