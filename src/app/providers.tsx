import { useEffect, type ReactNode } from 'react'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import { hydrateSession } from '@/features/auth/actions'
import { useAuthStore } from '@/stores/auth-store'

function AuthHydrator({ children }: { children: ReactNode }) {
  const setProfile = useAuthStore((s) => s.setProfile)
  const setHydrated = useAuthStore((s) => s.setHydrated)

  useEffect(() => {
    hydrateSession()
      .then((profile) => setProfile(profile))
      .finally(() => setHydrated(true))
  }, [setProfile, setHydrated])

  return <>{children}</>
}

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthHydrator>{children}</AuthHydrator>
    </QueryClientProvider>
  )
}
