'use client'

import { usePathname, useRouter } from 'next/navigation'
import { T, shadow, font, Avatar, initialsOf } from '../../../lib/design-system'
import { createSupabaseBrowserClient } from '@coaching/supabase/browser'

type IconProps = { active: boolean }
type NavItem = {
  id: string
  label: string
  href: string
  Icon: React.ComponentType<IconProps>
  soon?: boolean
}

function iconStroke(active: boolean) {
  return active ? T.primary : T.onSurfaceVar
}

function DashboardIcon({ active }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconStroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  )
}

function ClientsIcon({ active }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconStroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
    </svg>
  )
}

function PlansIcon({ active }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconStroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
    </svg>
  )
}

function MessagesIcon({ active }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconStroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
    </svg>
  )
}

function AlertsIcon({ active }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconStroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
    </svg>
  )
}

function ReportsIcon({ active }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconStroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" />
      <line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" />
    </svg>
  )
}

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', Icon: DashboardIcon },
  { id: 'clients', label: 'Clients', href: '/clients', Icon: ClientsIcon },
  { id: 'plans', label: 'Plans', href: '/plans', Icon: PlansIcon },
  { id: 'messages', label: 'Messages', href: '#', Icon: MessagesIcon, soon: true },
  { id: 'alerts', label: 'Alerts', href: '#', Icon: AlertsIcon, soon: true },
  { id: 'reports', label: 'Reports', href: '#', Icon: ReportsIcon, soon: true },
]

export function Shell({
  coachName,
  workspaceName,
  activeClientCount,
  children,
}: {
  coachName: string
  workspaceName: string
  activeClientCount: number
  children: React.ReactNode
}) {
  const pathname = usePathname()
  const router = useRouter()

  const title = pathname.startsWith('/clients/')
    ? 'Client Profile'
    : pathname.startsWith('/clients')
      ? 'Clients'
      : pathname.startsWith('/plans')
        ? 'Plans'
        : 'Dashboard'

  async function handleSignOut() {
    const supabase = createSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/login')
    router.refresh()
  }

  return (
    <div style={{ display: 'flex', height: '100vh', background: T.surface, fontFamily: font.body }}>
      <div
        style={{
          width: 220,
          background: T.surfaceLow,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: shadow.sidebar,
        }}
      >
        <div style={{ padding: '24px 20px 20px' }}>
          <div
            style={{
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              color: T.primary,
              textTransform: 'uppercase',
              marginBottom: 2,
            }}
          >
            CoachOS
          </div>
          <div style={{ fontFamily: font.heading, fontWeight: 800, fontSize: 16, color: T.onSurface }}>
            {workspaceName}
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{activeClientCount} active clients</div>
        </div>

        <nav style={{ flex: 1, padding: '0 10px' }}>
          {NAV.map(item => {
            const active = item.href !== '#' && pathname.startsWith(item.href)
            return (
              <a
                key={item.id}
                href={item.soon ? undefined : item.href}
                onClick={item.soon ? e => e.preventDefault() : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 10,
                  width: '100%',
                  padding: '10px 12px',
                  borderRadius: 8,
                  border: 'none',
                  cursor: item.soon ? 'default' : 'pointer',
                  background: active ? T.white : 'transparent',
                  boxShadow: active ? shadow.card : 'none',
                  marginBottom: 2,
                  textDecoration: 'none',
                  opacity: item.soon ? 0.5 : 1,
                }}
              >
                <item.Icon active={active} />
                <span
                  style={{
                    flex: 1,
                    textAlign: 'left',
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    color: active ? T.primary : T.onSurfaceVar,
                  }}
                >
                  {item.label}
                </span>
                {item.soon && (
                  <span
                    style={{
                      background: T.surfaceHigh,
                      color: T.muted,
                      fontSize: 9,
                      fontWeight: 700,
                      borderRadius: 10,
                      padding: '1px 6px',
                    }}
                  >
                    SOON
                  </span>
                )}
              </a>
            )
          })}
        </nav>

        <div style={{ padding: '16px 20px', borderTop: `1px solid ${T.border}`, display: 'flex', alignItems: 'center', gap: 10 }}>
          <Avatar initials={initialsOf(coachName)} size={34} />
          <div style={{ minWidth: 0, flex: 1 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.onSurface, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {coachName}
            </div>
            <button
              onClick={handleSignOut}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', fontSize: 11, color: T.muted, textDecoration: 'underline' }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div
          style={{
            height: 60,
            background: T.white,
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            alignItems: 'center',
            padding: '0 28px',
            flexShrink: 0,
          }}
        >
          <h1 style={{ margin: 0, fontFamily: font.heading, fontWeight: 800, fontSize: 18, color: T.onSurface }}>{title}</h1>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  )
}
