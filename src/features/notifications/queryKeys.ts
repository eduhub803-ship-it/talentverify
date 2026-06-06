import type { Profile } from '@/types/domain'

export const notificationsQueryKeys = {
  root: ['notifications'] as const,
  forUser: (profile: Profile) => ['notifications', profile.role, profile.id] as const,
}
