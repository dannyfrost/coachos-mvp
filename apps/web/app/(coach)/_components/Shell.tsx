'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { T, font, Avatar, initialsOf } from '../../../lib/design-system'
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

function SettingsIcon({ active }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconStroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
    </svg>
  )
}

function TeamIcon({ active }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconStroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 00-3-3.87" />
      <path d="M16 3.13a4 4 0 010 7.75" />
      <circle cx="9" cy="7" r="1" fill={iconStroke(active)} />
    </svg>
  )
}

function MoreIcon({ active }: IconProps) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={iconStroke(active)} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="5" cy="12" r="1.5" fill={iconStroke(active)} stroke="none" />
      <circle cx="12" cy="12" r="1.5" fill={iconStroke(active)} stroke="none" />
      <circle cx="19" cy="12" r="1.5" fill={iconStroke(active)} stroke="none" />
    </svg>
  )
}

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', Icon: DashboardIcon },
  { id: 'clients', label: 'Clients', href: '/clients', Icon: ClientsIcon },
  { id: 'plans', label: 'Plans', href: '/plans', Icon: PlansIcon },
  { id: 'messages', label: 'Messages', href: '/messages', Icon: MessagesIcon },
  { id: 'alerts', label: 'Alerts', href: '/alerts', Icon: AlertsIcon },
  { id: 'team', label: 'Team', href: '/team', Icon: TeamIcon },
  { id: 'reports', label: 'Reports', href: '/reports', Icon: ReportsIcon },
  { id: 'settings', label: 'Settings', href: '/settings', Icon: SettingsIcon },
]

// <768px bottom bar: a tight subset of NAV, relabeled for a thumb-width tab bar.
const BOTTOM_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Home', href: '/dashboard', Icon: DashboardIcon },
  { id: 'clients', label: 'Clients', href: '/clients', Icon: ClientsIcon },
  { id: 'messages', label: 'Inbox', href: '/messages', Icon: MessagesIcon },
  { id: 'alerts', label: 'Alerts', href: '/alerts', Icon: AlertsIcon },
]

// Remaining NAV entries, reached via the bottom bar's "More" sheet.
const MORE_NAV: NavItem[] = NAV.filter(item => !BOTTOM_NAV.some(b => b.id === item.id))

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
  const [navOpen, setNavOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)

  useEffect(() => {
    setNavOpen(false)
    setMoreOpen(false)
  }, [pathname])

  useEffect(() => {
    function handleResize() {
      if (window.innerWidth >= 768) {
        setMoreOpen(false)
      }
    }
    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  const title = pathname.startsWith('/clients/')
    ? 'Client Profile'
    : pathname.startsWith('/clients')
      ? 'Clients'
      : pathname.startsWith('/plans')
        ? 'Plans'
        : pathname.startsWith('/messages')
          ? 'Messages'
          : pathname.startsWith('/alerts')
            ? 'Alerts'
            : pathname.startsWith('/settings')
              ? 'Settings'
              : pathname.startsWith('/team')
                ? 'Team'
                : pathname.startsWith('/reports')
                  ? 'Reports'
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
        className={`shell-overlay${navOpen ? ' is-open' : ''}`}
        onClick={() => setNavOpen(false)}
      />
      <div
        className={`shell-sidebar${navOpen ? ' is-open' : ''}`}
        style={{
          width: 220,
          background: T.surfaceLow,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
          borderRight: `1px solid ${T.border}`,
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
                  borderRadius: 2,
                  border: 'none',
                  cursor: item.soon ? 'default' : 'pointer',
                  background: 'transparent',
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
                    fontFamily: font.body,
                    fontSize: 13,
                    fontWeight: active ? 700 : 500,
                    color: active ? T.primary : T.onSurfaceVar,
                    textDecoration: active ? 'underline' : 'none',
                    textUnderlineOffset: 3,
                  }}
                >
                  {item.label}
                </span>
                {item.soon && (
                  <span
                    style={{
                      background: T.surfaceHigh,
                      color: T.muted,
                      fontFamily: font.body,
                      fontSize: 9,
                      fontWeight: 700,
                      borderRadius: 2,
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

      <nav
        className="shell-bottombar"
        style={{
          height: 60,
          alignItems: 'stretch',
          padding: '0 4px',
        }}
      >
        {BOTTOM_NAV.map(item => {
          const active = pathname.startsWith(item.href)
          return (
            <a
              key={item.id}
              href={item.href}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                textDecoration: 'none',
              }}
            >
              <item.Icon active={active} />
              <span
                style={{
                  fontFamily: font.body,
                  fontSize: 10,
                  fontWeight: active ? 700 : 500,
                  color: active ? T.primary : T.onSurfaceVar,
                  textDecoration: active ? 'underline' : 'none',
                  textUnderlineOffset: 3,
                }}
              >
                {item.label}
              </span>
            </a>
          )
        })}
        <button
          onClick={() => setMoreOpen(v => !v)}
          aria-label="More"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 2,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
          }}
        >
          <MoreIcon active={moreOpen} />
          <span
            style={{
              fontFamily: font.body,
              fontSize: 10,
              fontWeight: moreOpen ? 700 : 500,
              color: moreOpen ? T.primary : T.onSurfaceVar,
              textDecoration: moreOpen ? 'underline' : 'none',
              textUnderlineOffset: 3,
            }}
          >
            More
          </span>
        </button>
      </nav>

      <div
        className={`shell-overlay-more${moreOpen ? ' is-open' : ''}`}
        onClick={() => setMoreOpen(false)}
      />
      {moreOpen && (
        <div
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 60,
            zIndex: 41,
            background: T.white,
            borderTop: `1px solid ${T.border}`,
            borderRadius: '2px 2px 0 0',
            padding: '8px 8px 4px',
          }}
        >
          {MORE_NAV.map(item => {
            const active = pathname.startsWith(item.href)
            return (
              <a
                key={item.id}
                href={item.href}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  textDecoration: 'none',
                }}
              >
                <item.Icon active={active} />
                <span
                  style={{
                    fontFamily: font.body,
                    fontSize: 14,
                    fontWeight: active ? 700 : 500,
                    color: active ? T.primary : T.onSurfaceVar,
                    textDecoration: active ? 'underline' : 'none',
                    textUnderlineOffset: 3,
                  }}
                >
                  {item.label}
                </span>
              </a>
            )
          })}
        </div>
      )}

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        <div
          style={{
            height: 60,
            background: T.white,
            borderBottom: `1px solid ${T.border}`,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '0 28px',
            flexShrink: 0,
          }}
        >
          <button
            className="shell-hamburger"
            onClick={() => setNavOpen(v => !v)}
            aria-label="Toggle navigation"
            style={{
              alignItems: 'center',
              justifyContent: 'center',
              width: 32,
              height: 32,
              padding: 0,
              margin: '0 -6px 0 -8px',
              border: 'none',
              background: 'none',
              cursor: 'pointer',
              flexShrink: 0,
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={T.onSurface} strokeWidth="2.2" strokeLinecap="round">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <h1 style={{ margin: 0, fontFamily: font.heading, fontWeight: 800, fontSize: 18, color: T.onSurface }}>{title}</h1>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  )
}
