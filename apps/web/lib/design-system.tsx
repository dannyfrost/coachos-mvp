export const T = {
  primary: '#00488d',
  primaryMid: '#005fb8',
  primaryLight: '#e8f1fb',
  surface: '#f7f9fb',
  surfaceLow: '#f2f4f6',
  surfaceHigh: '#eceef1',
  white: '#ffffff',
  onSurface: '#191c1e',
  onSurfaceVar: '#424752',
  muted: '#9ca3af',
  border: 'rgba(25,28,30,0.07)',
  success: '#065f46',
  successBg: '#d1fae5',
  successMid: '#10b981',
  amber: '#92400e',
  amberBg: '#fef3c7',
  amberMid: '#f59e0b',
  red: '#991b1b',
  redBg: '#fde8e8',
  redMid: '#ef4444',
  blue: '#1e40af',
  blueBg: '#dbeafe',
} as const

export const shadow = {
  card: 'none',
  float: 'none',
  sidebar: 'none',
}

export const font = {
  // Neutral sans for dense coach UI (headings + body) — improves scanability.
  // Fraunces is reserved for marketing / auth / empty-state display via
  // `font.display`, keeping the editorial accent without slowing operators down.
  heading: 'var(--font-public-sans), -apple-system, sans-serif',
  body: 'var(--font-public-sans), -apple-system, sans-serif',
  display: 'var(--font-fraunces), Georgia, serif',
}

// Spacing scale (4px base). Prefer these over ad-hoc pixel values so rhythm
// stays consistent across pages.
export const space = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const

// Type scale (px), intentional steps for a clear hierarchy.
export const type = {
  caption: 11,
  small: 12,
  body: 14,
  base: 16,
  h3: 20,
  h2: 24,
  h1: 30,
} as const

// Elevation: flat stays the identity; exactly one soft shadow, for overlays
// (dialogs/popovers) so layering reads correctly.
export const elevation = { overlay: '0 8px 24px rgba(16,24,40,0.12)' } as const

export function Card({
  children,
  style = {},
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div style={{ background: T.white, borderRadius: 12, border: `1px solid ${T.border}`, padding: 20, ...style }}>
      {children}
    </div>
  )
}

const BADGE_MAP: Record<string, { bg: string; text: string; label: string }> = {
  green: { bg: T.successBg, text: T.success, label: 'On Track' },
  yellow: { bg: T.amberBg, text: T.amber, label: 'Needs Attention' },
  red: { bg: T.redBg, text: T.red, label: 'At Risk' },
  paused: { bg: '#f3f4f6', text: T.muted, label: 'Paused' },
  active: { bg: T.successBg, text: T.success, label: 'Active' },
  pending: { bg: T.blueBg, text: T.blue, label: 'Pending' },
  suspended: { bg: T.redBg, text: T.red, label: 'Suspended' },
  banned: { bg: T.redBg, text: T.red, label: 'Banned' },
  deactivated: { bg: '#f3f4f6', text: T.muted, label: 'Deactivated' },
  expired: { bg: T.redBg, text: T.red, label: 'Expired' },
  overdue: { bg: T.amberBg, text: T.amber, label: 'Overdue' },
  meal: { bg: '#f0fdf4', text: '#166534', label: 'Meal' },
  workout: { bg: T.blueBg, text: T.blue, label: 'Workout' },
  message_sent: { bg: T.amberBg, text: T.amber, label: 'Message Sent' },
  escalated_to_coach: { bg: T.redBg, text: T.red, label: 'Escalated' },
  resolved: { bg: T.successBg, text: T.success, label: 'Resolved' },
}

export function Badge({ status, small, labelOverride }: { status: string; small?: boolean; labelOverride?: string }) {
  const s = BADGE_MAP[status] || { bg: '#f3f4f6', text: T.muted, label: status }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: small ? '2px 8px' : '3px 10px',
        borderRadius: 8,
        background: s.bg,
        color: s.text,
        fontSize: small ? 10 : 11,
        fontWeight: 700,
        letterSpacing: '0.04em',
        fontFamily: font.body,
        whiteSpace: 'nowrap',
      }}
    >
      {labelOverride ?? s.label}
    </span>
  )
}

export function StatusWord({
  status,
  labelOverride,
  style = {},
}: {
  status: string
  labelOverride?: string
  style?: React.CSSProperties
}) {
  const s = BADGE_MAP[status] || { bg: '#f3f4f6', text: T.muted, label: status }
  return (
    <span
      style={{
        fontFamily: font.body,
        fontWeight: 600,
        fontSize: 13,
        color: s.text,
        textDecoration: 'underline',
        textUnderlineOffset: 3,
        ...style,
      }}
    >
      {labelOverride ?? s.label}
    </span>
  )
}

export function FlashDot({ status }: { status: string }) {
  const colors: Record<string, string> = {
    green: T.successMid,
    yellow: T.amberMid,
    red: T.redMid,
    paused: T.muted,
  }
  return (
    <div
      style={{
        width: 10,
        height: 10,
        borderRadius: '50%',
        background: colors[status] || '#e5e7eb',
        flexShrink: 0,
      }}
    />
  )
}

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'success'

export function Btn({
  children,
  variant = 'primary',
  onClick,
  small,
  full,
  disabled,
  type = 'button',
  style = {},
}: {
  children: React.ReactNode
  variant?: BtnVariant
  onClick?: () => void
  small?: boolean
  full?: boolean
  disabled?: boolean
  type?: 'button' | 'submit'
  style?: React.CSSProperties
}) {
  const variants: Record<BtnVariant, React.CSSProperties> = {
    primary: {
      background: T.primary,
      color: '#fff',
      border: 'none',
    },
    secondary: { background: T.surfaceHigh, color: T.primary, border: 'none' },
    ghost: { background: 'transparent', color: T.primary, border: 'none' },
    danger: { background: T.redBg, color: T.red, border: 'none' },
    success: { background: T.successBg, color: T.success, border: 'none' },
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{
        padding: small ? '5px 12px' : '8px 16px',
        borderRadius: 8,
        cursor: disabled ? 'not-allowed' : 'pointer',
        fontFamily: font.body,
        fontWeight: 600,
        fontSize: small ? 12 : 13,
        width: full ? '100%' : undefined,
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s',
        ...variants[variant],
        ...style,
      }}
    >
      {children}
    </button>
  )
}

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: T.muted,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        fontFamily: font.body,
        marginBottom: 10,
      }}
    >
      {children}
    </div>
  )
}

export function FieldLabel({ children }: { children: React.ReactNode }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        color: T.muted,
        letterSpacing: '0.07em',
        textTransform: 'uppercase',
        fontFamily: font.body,
        marginBottom: 6,
      }}
    >
      {children}
    </div>
  )
}

export const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  background: T.surfaceLow,
  border: 'none',
  borderBottom: `2px solid ${T.primary}`,
  borderRadius: '8px 8px 0 0',
  fontFamily: font.body,
  fontSize: 14,
  color: T.onSurface,
  outline: 'none',
  boxSizing: 'border-box',
}

export function Avatar({ initials, size = 36 }: { initials: string; size?: number }) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: 8,
        background: T.primary,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#fff',
        fontFamily: font.heading,
        fontWeight: 700,
        fontSize: size * 0.36,
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
}

export function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 0 || !parts[0]) return '?'
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase()
}

// Loading placeholder. Shimmer + reduced-motion handling live in globals.css
// (`.sk`). Replaces the dead Tailwind skeletons in the route loading.tsx files.
export function Skeleton({
  w = '100%',
  h = 16,
  radius = 2,
  style = {},
}: {
  w?: number | string
  h?: number | string
  radius?: number
  style?: React.CSSProperties
}) {
  return <div className="sk" style={{ width: w, height: h, borderRadius: radius, ...style }} />
}
