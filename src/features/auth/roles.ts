import type { Profile, UserRole } from '@/types/domain'

export function isPlatformAdminRole(role: UserRole | null | undefined): boolean {
  return role === 'admin' || role === 'super_admin'
}

export function isPlatformAdmin(profile: Profile | null | undefined): profile is Profile {
  return isPlatformAdminRole(profile?.role)
}
