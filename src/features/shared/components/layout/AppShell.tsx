import { useContext, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, ChevronDown, Globe, LogOut, Menu } from 'lucide-react'
import { Sidebar, type NavItem } from './Sidebar'
import { Avatar } from '../ui/Avatar'
import { Button } from '../ui/Button'
import { useAuthStore } from '@/stores/auth-store'
import { logoutUser } from '@/features/auth/actions'
import { LanguageContext } from '@/context/LanguageContext'
import {
  fetchMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
} from '@/features/notifications/actions'
import { notificationsQueryKeys } from '@/features/notifications/queryKeys'
import { formatDate } from '@/lib/utils'

/** Closes a header popover on outside click or Escape. */
function useDismissable(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!ref.current?.contains(event.target as Node)) onClose()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }

    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open, onClose])

  return ref
}

function NotificationBell() {
  const [open, setOpen] = useState(false)
  const profile = useAuthStore((s) => s.profile)
  const qc = useQueryClient()
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

  const queryKey = profile ? notificationsQueryKeys.forUser(profile) : ['notifications']

  const { data: notifications = [] } = useQuery({
    queryKey,
    queryFn: () => fetchMyNotifications(profile!),
    enabled: Boolean(profile),
  })

  const markRead = useMutation({
    mutationFn: (id: string) => markNotificationRead(profile!, id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey })
    },
  })

  const markAllRead = useMutation({
    mutationFn: () => markAllNotificationsRead(profile!),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey })
    },
  })

  const unreadCount = notifications.filter((notification) => !notification.isRead).length
  const containerRef = useDismissable(open, () => setOpen(false))

  if (!profile) return null

  return (
    <div className="relative" ref={containerRef}>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="relative px-2"
        aria-label={t('notifications.title')}
        onClick={() => setOpen((value) => !value)}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-semibold text-white">
            {unreadCount}
          </span>
        )}
      </Button>

      {open && (
        <div className="absolute right-0 z-50 mt-2 w-[min(360px,calc(100vw-2rem))] overflow-hidden rounded-xl border border-border bg-white shadow-lg">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="font-semibold text-foreground">{t('notifications.title')}</p>
              <p className="text-xs text-muted">
                {unreadCount} {t('notifications.unread')}
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={notifications.length === 0 || markAllRead.isPending}
              onClick={() => markAllRead.mutate()}
            >
              {t('notifications.markAllRead')}
            </Button>
          </div>

          <div className="max-h-96 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted">
                {t('notifications.empty')}
              </p>
            ) : (
              notifications.map((notification) => (
                <button
                  key={notification.id}
                  type="button"
                  className="block w-full border-b border-border px-4 py-3 text-left last:border-b-0 hover:bg-slate-50"
                  onClick={() => markRead.mutate(notification.id)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-foreground">{notification.title}</p>
                    {!notification.isRead && (
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                    )}
                  </div>
                  <p className="mt-1 text-sm text-muted">{notification.message}</p>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs text-muted">
                    <span>{notification.type}</span>
                    <span>{notification.priority}</span>
                    <span>{formatDate(notification.createdAt)}</span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function LanguageToggle() {
  const language = useContext(LanguageContext)

  if (!language) {
    return null
  }

  const nextLang = language.lang === 'ar' ? 'en' : 'ar'

  return (
    <Button
      variant="secondary"
      size="sm"
      className="gap-2 px-2 sm:px-3"
      onClick={() => language.setLang(nextLang)}
    >
      <Globe className="h-4 w-4" />
      <span className="hidden sm:inline">{language.t('languageToggle')}</span>
    </Button>
  )
}

export function AppShell({
  navItems,
  children,
}: {
  navItems: NavItem[]
  children: ReactNode
}) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useDismissable(userMenuOpen, () => setUserMenuOpen(false))
  const profile = useAuthStore((s) => s.profile)
  const navigate = useNavigate()
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)
  const userName = profile?.fullName ?? profile?.email ?? 'TalentVerify'
  const roleLabel = profile?.role ? `${profile.role.charAt(0).toUpperCase()}${profile.role.slice(1)}` : ''

  const handleLogout = async () => {
    await logoutUser()
    navigate('/login')
  }

  return (
    <div className="flex min-h-screen bg-surface">
      <Sidebar
        items={navItems}
        mobileOpen={mobileOpen}
        onMobileClose={() => setMobileOpen(false)}
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-white/90 px-4 backdrop-blur sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              className="rounded-lg p-2 text-muted hover:bg-slate-100 lg:hidden"
              onClick={() => setMobileOpen(true)}
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex min-w-0 items-center gap-2 font-semibold text-foreground">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-sm text-white">
                TV
              </span>
              <span className="truncate">TalentVerify</span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <NotificationBell />
            <LanguageToggle />
            <div className="relative" ref={userMenuRef}>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="gap-2 px-2 sm:px-3"
                onClick={() => setUserMenuOpen((value) => !value)}
              >
                <Avatar
                  src={profile?.avatarUrl}
                  name={profile?.fullName}
                  email={profile?.email}
                  size="sm"
                />
                <span className="hidden max-w-40 truncate text-sm font-medium sm:inline">
                  {userName}
                </span>
                <ChevronDown className="h-4 w-4 text-muted" />
              </Button>

              {userMenuOpen && (
                <div className="absolute end-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-border bg-white text-start shadow-lg">
                  <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                    <Avatar
                      src={profile?.avatarUrl}
                      name={profile?.fullName}
                      email={profile?.email}
                      size="md"
                    />
                    <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{userName}</p>
                    {roleLabel && (
                      <p className="mt-1 text-xs capitalize text-muted">{roleLabel}</p>
                    )}
                    </div>
                  </div>
                  <div className="p-2">
                    <button
                      type="button"
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-slate-50"
                      onClick={handleLogout}
                    >
                      <LogOut className="h-4 w-4" />
                      {t('Sign out')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6 lg:p-8">
          {children}
        </main>
      </div>
    </div>
  )
}

export function PublicShell({ children }: { children: ReactNode }) {
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

  return (
    <div className="min-h-screen bg-surface">
      <header className="border-b border-border bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
          <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-sm text-white">
              TV
            </span>
            TalentVerify
          </Link>
          <div className="flex items-center gap-2">
            <Link to="/login">
              <Button variant="ghost" size="sm">
                {t('Sign in')}
              </Button>
            </Link>
            <Link to="/register">
              <Button size="sm">{t('Get started')}</Button>
            </Link>
          </div>
        </div>
      </header>
      {children}
    </div>
  )
}
