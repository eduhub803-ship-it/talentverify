import { Outlet } from 'react-router-dom'
import { Briefcase, Building2, Handshake, Home, Search } from 'lucide-react'
import { AppShell } from '@/features/shared/components/layout/AppShell'

const navItems = [
  { to: '/hr', label: 'Dashboard', icon: Home, end: true },
  { to: '/hr/search', label: 'Search Candidates', icon: Search },
  { to: '/hr/jobs', label: 'Jobs', icon: Briefcase },
  { to: '/hr/services', label: 'Recruitment Services', icon: Handshake },
  { to: '/hr/organization', label: 'Organization', icon: Building2 },
]

export function HRLayout() {
  return (
    <AppShell navItems={navItems}>
      <Outlet />
    </AppShell>
  )
}
