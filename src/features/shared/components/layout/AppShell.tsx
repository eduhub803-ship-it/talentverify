import { useContext, useState, type ReactNode } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { LogOut, Menu } from 'lucide-react'
import { Sidebar, type NavItem } from './Sidebar'
import { Button } from '../ui/Button'
import { useAuthStore } from '@/stores/auth-store'
import { logoutUser } from '@/features/auth/actions'
import { LanguageContext } from '@/context/LanguageContext'

function LanguageToggle() {
  const language = useContext(LanguageContext)

  if (!language) {
    return null
  }

  const nextLang = language.lang === 'ar' ? 'en' : 'ar'

  return (
    <Button variant="secondary" size="sm" onClick={() => language.setLang(nextLang)}>
      {language.t('languageToggle')}
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
  const profile = useAuthStore((s) => s.profile)
  const navigate = useNavigate()
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

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
          <button
            type="button"
            className="rounded-lg p-2 text-muted hover:bg-slate-100 lg:hidden"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="ml-auto flex items-center gap-4">
            <LanguageToggle />
            <div className="hidden text-right sm:block">
              <p className="text-sm font-medium text-foreground">
                {profile?.fullName ?? profile?.email}
              </p>
              <p className="text-xs capitalize text-muted">{profile?.role}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4" />
              {t('Sign out')}
            </Button>
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
