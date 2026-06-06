import { mockDb } from '@/lib/api/mock-db'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import type { AppNotification, Profile } from '@/types/domain'

export async function fetchMyNotifications(
  currentUser: Profile,
): Promise<AppNotification[]> {
  if (!isSupabaseConfigured) {
    return mockDb.getNotificationsForUser(currentUser)
  }

  return []
}

export async function markNotificationRead(
  currentUser: Profile,
  notificationId: string,
): Promise<void> {
  if (!isSupabaseConfigured) {
    mockDb.markNotificationRead(currentUser, notificationId)
  }
}

export async function markAllNotificationsRead(
  currentUser: Profile,
): Promise<void> {
  if (!isSupabaseConfigured) {
    mockDb.markAllNotificationsRead(currentUser)
  }
}
