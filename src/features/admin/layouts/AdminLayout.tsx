import { Outlet } from 'react-router-dom'
import { Building2, ClipboardList, GraduationCap, Handshake, Home, Upload, Users } from 'lucide-react'
import { AppShell } from '@/features/shared/components/layout/AppShell'

const navItems = [
  { to: '/admin', label: 'Dashboard', icon: Home, end: true },
  { to: '/admin/verification-queue', label: 'Verification Queue', icon: ClipboardList },
  { to: '/admin/hr-approvals', label: 'HR Approvals', icon: Building2 },
  { to: '/admin/import-candidates', label: 'Import Candidates', icon: Upload },
  { to: '/admin/imported-candidates', label: 'Imported Candidates', icon: Users },
  { to: '/admin/career-services', label: 'Career Services', icon: GraduationCap },
  { to: '/admin/employer-services', label: 'Employer Services', icon: Handshake },
]

export function AdminLayout() {
  return (
    <AppShell navItems={navItems}>
      <Outlet />
    </AppShell>
  )
}
