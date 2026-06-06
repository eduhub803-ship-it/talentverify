import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/stores/auth-store'
import type { UserRole } from '@/types/domain'

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
    </div>
  )
}

export function PublicRoute() {
  const { profile, isHydrated } = useAuthStore()
  const location = useLocation()

  if (!isHydrated) return <LoadingScreen />
  if (profile) {
    const from = (location.state as { from?: string })?.from
    const dest =
      from ??
      (profile.role === 'candidate'
        ? '/candidate'
        : profile.role === 'hr'
          ? '/hr'
          : '/admin')
    return <Navigate to={dest} replace />
  }
  return <Outlet />
}

export function ProtectedRoute({ role }: { role?: UserRole }) {
  const { profile, isHydrated } = useAuthStore()
  const location = useLocation()

  if (!isHydrated) return <LoadingScreen />
  if (!profile) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />
  }
  if (role && profile.role !== role) {
    return <Navigate to="/" replace />
  }
  return <Outlet />
}
