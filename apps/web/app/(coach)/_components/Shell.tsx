'use client'

import { Fragment, useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  FileText,
  MessageSquare,
  Bell,
  UsersRound,
  BarChart3,
  Settings,
  MoreHorizontal,
  Menu,
  type LucideIcon,
} from 'lucide-react'
import { T, font, Avatar, initialsOf } from '../../../lib/design-system'
import { createSupabaseBrowserClient } from '@coaching/supabase/browser'

type NavItem = {
  id: string
  label: string
  href: string
  Icon: LucideIcon
  soon?: boolean
}

const NAV: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', href: '/dashboard', Icon: LayoutDashboard },
  { id: 'clients', label: 'Clients', href: '/clients', Icon: Users },
  { id: 'plans', label: 'Plans', href: '/plans', Icon: FileText },
  { id: 'messages', label: 'Messages', href: '/messages', Icon: MessageSquare },
  { id: 'alerts', label: 'Alerts', href: '/alerts', Icon: Bell },
  { id: 'team', label: 'Team', href: '/team', Icon: UsersRound },
  { id: 'reports', label: 'Reports', href: '/reports', Icon: BarChart3 },
  { id: 'settings', label: 'Settings', href: '/settings', Icon: Settings },
]

// <768px bottom bar: a tight subset of NAV, relabeled for a thumb-width tab bar.
const BOTTOM_NAV: NavItem[] = [
  { id: 'dashboard', label: 'Home', href: '/dashboard', Icon: LayoutDashboard },
  { id: 'clients', label: 'Clients', href: '/clients', Icon: Users },
  { id: 'messages', label: 'Inbox', href: '/messages', Icon: MessageSquare },
  { id: 'alerts', label: 'Alerts', href: '/alerts', Icon: Bell },
]

// Remaining NAV entries, reached via the bottom bar's "More" sheet.
const MORE_NAV: NavItem[] = NAV.filter((item) => !BOTTOM_NAV.some((b) => b.id === item.id))

const ICON_SIZE = 18

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
        className={`shell-sidebar shell-glass-panel${navOpen ? ' is-open' : ''}`}
        style={{
          width: 220,
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <div style={{ padding: '22px 18px 18px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 16 }}>
            <div
              style={{
                width: 26,
                height: 26,
                borderRadius: 8,
                background: T.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontFamily: font.display,
                fontWeight: 600,
                fontSize: 15,
                flexShrink: 0,
              }}
            >
              C
            </div>
            <span style={{ fontFamily: font.body, fontWeight: 600, fontSize: 14, letterSpacing: '-0.01em', color: T.onSurface }}>CoachOS</span>
          </div>
          <div style={{ fontFamily: font.display, fontWeight: 600, fontSize: 18, color: T.onSurface }}>
            {workspaceName}
          </div>
          <div style={{ fontSize: 11, color: T.muted, marginTop: 2 }}>{activeClientCount} active clients</div>
        </div>

        <nav style={{ flex: 1, padding: '0 12px' }}>
          {NAV.map((item) => {
            const active = item.href !== '#' && pathname.startsWith(item.href)
            return (
              <Fragment key={item.id}>
                {/* Group operational nav from workspace admin (Team/Reports/Settings). */}
                {item.id === 'team' && <div style={{ height: 1, background: T.border, margin: '12px 12px' }} />}
                <a
                  href={item.soon ? undefined : item.href}
                  onClick={item.soon ? (e) => e.preventDefault() : undefined}
                  aria-current={active ? 'page' : undefined}
                  className="shell-navitem"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: 10,
                    border: 'none',
                    cursor: item.soon ? 'default' : 'pointer',
                    background: active ? T.primaryLight : 'transparent',
                    marginBottom: 3,
                    textDecoration: 'none',
                    opacity: item.soon ? 0.5 : 1,
                  }}
                >
                  <item.Icon size={ICON_SIZE} color={active ? T.primary : T.onSurfaceVar} strokeWidth={active ? 2.4 : 2} />
                  <span
                    style={{
                      flex: 1,
                      textAlign: 'left',
                      fontFamily: font.body,
                      fontSize: 13,
                      fontWeight: active ? 600 : 500,
                      color: active ? T.primary : T.onSurfaceVar,
                    }}
                  >
                    {item.label}
                  </span>
                  {item.soon && (
                    <span style={{ background: T.surfaceHigh, color: T.muted, fontFamily: font.body, fontSize: 9, fontWeight: 700, borderRadius: 8, padding: '1px 6px' }}>
                      SOON
                    </span>
                  )}
                </a>
              </Fragment>
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
        className="shell-bottombar shell-glass-bar"
        style={{
          height: 60,
          alignItems: 'stretch',
          padding: '0 4px',
        }}
      >
        {BOTTOM_NAV.map((item) => {
          const active = pathname.startsWith(item.href)
          return (
            <a
              key={item.id}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 3,
                textDecoration: 'none',
              }}
            >
              <item.Icon size={20} color={active ? T.primary : T.onSurfaceVar} strokeWidth={active ? 2.4 : 2} />
              <span
                style={{
                  fontFamily: font.body,
                  fontSize: 10,
                  fontWeight: active ? 700 : 500,
                  color: active ? T.primary : T.onSurfaceVar,
                }}
              >
                {item.label}
              </span>
            </a>
          )
        })}
        <button
          onClick={() => setMoreOpen((v) => !v)}
          aria-label="More"
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 3,
            border: 'none',
            background: 'none',
            cursor: 'pointer',
          }}
        >
          <MoreHorizontal size={20} color={moreOpen ? T.primary : T.onSurfaceVar} strokeWidth={2} />
          <span
            style={{
              fontFamily: font.body,
              fontSize: 10,
              fontWeight: moreOpen ? 700 : 500,
              color: moreOpen ? T.primary : T.onSurfaceVar,
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
          className="shell-sheet shell-glass-bar"
          style={{
            position: 'fixed',
            left: 0,
            right: 0,
            bottom: 60,
            zIndex: 41,
            borderRadius: '10px 10px 0 0',
            padding: '8px 8px 4px',
          }}
        >
          {MORE_NAV.map((item) => {
            const active = pathname.startsWith(item.href)
            return (
              <a
                key={item.id}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  padding: '12px 14px',
                  borderRadius: 6,
                  background: active ? T.primaryLight : 'transparent',
                  textDecoration: 'none',
                }}
              >
                <item.Icon size={ICON_SIZE} color={active ? T.primary : T.onSurfaceVar} strokeWidth={active ? 2.4 : 2} />
                <span
                  style={{
                    fontFamily: font.body,
                    fontSize: 14,
                    fontWeight: active ? 700 : 500,
                    color: active ? T.primary : T.onSurfaceVar,
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
          className="shell-topbar shell-glass-bar"
          style={{
            height: 60,
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            padding: '0 28px',
            flexShrink: 0,
          }}
        >
          <button
            className="shell-hamburger"
            onClick={() => setNavOpen((v) => !v)}
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
            <Menu size={20} color={T.onSurface} strokeWidth={2.2} />
          </button>
          <h1 style={{ margin: 0, fontFamily: font.heading, fontWeight: 700, fontSize: 18, color: T.onSurface }}>{title}</h1>
        </div>
        <div style={{ flex: 1, overflowY: 'auto' }}>{children}</div>
      </div>
    </div>
  )
}
