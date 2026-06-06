import { Outlet } from 'react-router-dom'
import {
  FileText,
  Briefcase,
  Home,
  Inbox,
  Shield,
  Sparkles,
  Upload,
  User,
} from 'lucide-react'
import { AppShell } from '@/features/shared/components/layout/AppShell'

const navItems = [
  { to: '/candidate', label: 'Dashboard', icon: Home, end: true },
  { to: '/candidate/profile', label: 'Profile', icon: User },
  { to: '/jobs', label: 'Jobs', icon: Briefcase },
  { to: '/candidate/upload/cv', label: 'Upload CV', icon: FileText },
  { to: '/candidate/upload/documents', label: 'Documents', icon: Upload },
  { to: '/candidate/verification', label: 'Verification', icon: Shield },
  { to: '/candidate/cv-evaluation', label: 'AI CV Evaluation', icon: Sparkles },
  { to: '/candidate/contact-requests', label: 'Contact Requests', icon: Inbox },
]

export function CandidateLayout() {
  return (
    <AppShell navItems={navItems}>
      <Outlet />
    </AppShell>
  )
}
