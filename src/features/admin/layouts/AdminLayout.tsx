import { Outlet } from 'react-router-dom'
import { Building2, ClipboardList, Home } from 'lucide-react'
import { AppShell } from '@/features/shared/components/layout/AppShell'

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: Home, end: true },
  { to: '/admin/verification-queue', label: 'Verification Queue', icon: ClipboardList },
  { to: '/admin/hr-approvals', label: 'HR Approvals', icon: Building2 },
]

export function AdminLayout() {
  return (
    <AppShell navItems={navItems}>
      <Outlet />
    </AppShell>
  )
}
