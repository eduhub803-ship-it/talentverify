import { NavLink } from 'react-router-dom'
import { ShieldCheck, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useContext } from 'react'
import { LanguageContext } from '@/context/LanguageContext'

export interface NavItem {
  to: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  end?: boolean
}

export function Sidebar({
  items,
  mobileOpen,
  onMobileClose,
}: {
  items: NavItem[]
  mobileOpen: boolean
  onMobileClose: () => void
}) {
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

  return (
    <>
      {mobileOpen && (
        <button
          type="button"
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-label="Close menu"
          onClick={onMobileClose}
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-border bg-white transition-transform lg:static lg:translate-x-0',
          mobileOpen ? 'translate-x-0' : '-translate-x-full',
        )}
      >
        <div className="flex h-16 items-center justify-between border-b border-border px-5">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <span className="font-semibold text-foreground">TalentVerify</span>
          </div>
          <button
            type="button"
            className="rounded-lg p-1 text-muted hover:bg-slate-100 lg:hidden"
            onClick={onMobileClose}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {items.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={onMobileClose}
              className={({ isActive }) =>
                cn(
                  'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-primary-50 text-primary'
                    : 'text-muted hover:bg-slate-50 hover:text-foreground',
                )
              }
            >
              <item.icon className="h-5 w-5 shrink-0" />
              {t(item.label)}
            </NavLink>
          ))}
        </nav>
      </aside>
    </>
  )
}
