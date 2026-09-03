/**
 * A small hand-authored icon set. Inline SVG rather than a font or a package:
 * eight nav icons and a dozen UI marks do not justify a dependency, and these
 * inherit currentColor so they follow the theme without extra rules.
 */
import type { SVGProps } from 'react'

type Props = SVGProps<SVGSVGElement> & { size?: number }

function Svg({ size = 18, children, ...rest }: Props) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...rest}
    >
      {children}
    </svg>
  )
}

/* ---- navigation ---- */

export const IconPipeline = (p: Props) => (
  <Svg {...p}>
    <rect x="3" y="4" width="5" height="16" rx="1.5" />
    <rect x="10" y="4" width="5" height="11" rx="1.5" />
    <rect x="17" y="4" width="4" height="7" rx="1.5" />
  </Svg>
)

export const IconCapacity = (p: Props) => (
  <Svg {...p}>
    <path d="M4 18a8 8 0 1 1 16 0" />
    <path d="M12 18 16 11" />
    <circle cx="12" cy="18" r="1.3" fill="currentColor" stroke="none" />
  </Svg>
)

export const IconTasks = (p: Props) => (
  <Svg {...p}>
    <path d="m3 7 2.2 2.2L9 5.5" />
    <path d="m3 16.5 2.2 2.2L9 15" />
    <path d="M13 7.5h8" />
    <path d="M13 17h8" />
  </Svg>
)

export const IconLedger = (p: Props) => (
  <Svg {...p}>
    <path d="M5 3.5h14v17l-2.3-1.6-2.35 1.6L12 18.9l-2.35 1.6L7.3 18.9 5 20.5z" />
    <path d="M9 8.5h6" />
    <path d="M9 12.5h6" />
  </Svg>
)

export const IconChecklist = (p: Props) => (
  <Svg {...p}>
    <rect x="4" y="3.5" width="16" height="17" rx="2" />
    <path d="m8 9.2 1.6 1.6L13 7.4" />
    <path d="m8 15.6 1.6 1.6L13 13.8" />
    <path d="M15.5 10.5H17" />
    <path d="M15.5 16.9H17" />
  </Svg>
)

export const IconDocuments = (p: Props) => (
  <Svg {...p}>
    <path d="M3.5 6.5A2 2 0 0 1 5.5 4.5h3.2l1.9 2.3h7.9a2 2 0 0 1 2 2v8.7a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2z" />
  </Svg>
)

export const IconWeekly = (p: Props) => (
  <Svg {...p}>
    <rect x="3.5" y="5" width="17" height="15.5" rx="2" />
    <path d="M3.5 10h17" />
    <path d="M8 3.5v3" />
    <path d="M16 3.5v3" />
    <path d="M8 14h2.5" />
    <path d="M14 14h2" />
    <path d="M8 17.3h5" />
  </Svg>
)

export const IconTeam = (p: Props) => (
  <Svg {...p}>
    <circle cx="9" cy="8" r="3.2" />
    <path d="M3.2 19.5a5.8 5.8 0 0 1 11.6 0" />
    <path d="M16.2 5.3a3.2 3.2 0 0 1 0 5.6" />
    <path d="M17.6 14.4a5.8 5.8 0 0 1 3.2 5.1" />
  </Svg>
)

/* ---- interface ---- */

export const IconClose = (p: Props) => (
  <Svg {...p}><path d="m6 6 12 12" /><path d="m18 6-12 12" /></Svg>
)

export const IconPlus = (p: Props) => (
  <Svg {...p}><path d="M12 5v14" /><path d="M5 12h14" /></Svg>
)

export const IconCheck = (p: Props) => (
  <Svg {...p}><path d="m4.5 12.5 5 5 10-11" /></Svg>
)

export const IconAlert = (p: Props) => (
  <Svg {...p}>
    <path d="M10.3 4.3 2.9 17.2a2 2 0 0 0 1.7 3h14.8a2 2 0 0 0 1.7-3L13.7 4.3a2 2 0 0 0-3.4 0z" />
    <path d="M12 9.5v4" />
    <circle cx="12" cy="17" r=".9" fill="currentColor" stroke="none" />
  </Svg>
)

export const IconUpload = (p: Props) => (
  <Svg {...p}>
    <path d="M12 15.5V4.2" />
    <path d="m7.5 8.5 4.5-4.3 4.5 4.3" />
    <path d="M4 15.5v2.7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2.7" />
  </Svg>
)

export const IconTrash = (p: Props) => (
  <Svg {...p}>
    <path d="M4.5 6.5h15" />
    <path d="M9.5 6.5V4.8a1.3 1.3 0 0 1 1.3-1.3h2.4a1.3 1.3 0 0 1 1.3 1.3V6.5" />
    <path d="M6.5 6.5 7.4 19a1.6 1.6 0 0 0 1.6 1.5h6a1.6 1.6 0 0 0 1.6-1.5l.9-12.5" />
  </Svg>
)

export const IconOpen = (p: Props) => (
  <Svg {...p}>
    <path d="M14 4.5h5.5V10" />
    <path d="M19.5 4.5 11 13" />
    <path d="M18 14v4.5a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2v-10a2 2 0 0 1 2-2h4.4" />
  </Svg>
)

export const IconSun = (p: Props) => (
  <Svg {...p}>
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2.6v2.1M12 19.3v2.1M4.2 4.2l1.5 1.5M18.3 18.3l1.5 1.5M2.6 12h2.1M19.3 12h2.1M4.2 19.8l1.5-1.5M18.3 5.7l1.5-1.5" />
  </Svg>
)

export const IconMoon = (p: Props) => (
  <Svg {...p}>
    <path d="M20 14.2A8.4 8.4 0 0 1 9.8 4 8.4 8.4 0 1 0 20 14.2z" />
  </Svg>
)

export const IconSignOut = (p: Props) => (
  <Svg {...p}>
    <path d="M15 7.5V5.8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v12.4a2 2 0 0 0 2 2h7a2 2 0 0 0 2-2V16.5" />
    <path d="M10 12h10" />
    <path d="m17 8.8 3.2 3.2L17 15.2" />
  </Svg>
)

export const IconMenu = (p: Props) => (
  <Svg {...p}><path d="M4 7h16" /><path d="M4 12h16" /><path d="M4 17h16" /></Svg>
)

export const NAV_ICON = {
  pipeline: IconPipeline,
  capacity: IconCapacity,
  tasks: IconTasks,
  ledger: IconLedger,
  checklist: IconChecklist,
  documents: IconDocuments,
  weekly: IconWeekly,
  team: IconTeam,
} as const
