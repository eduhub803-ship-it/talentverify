import { mockDb } from '@/lib/api/mock-db'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import type { AppNotification, Profile } from '@/types/domain'

function mapNotification(row: Record<string, unknown>): AppNotification {
  return {
    id: row.id as string,
    recipientUserId: (row.recipient_user_id as string | null) ?? null,
    recipientRole: row.recipient_role as AppNotification['recipientRole'],
    recipientOrganizationId: (row.recipient_organization_id as string | null) ?? null,
    type: row.type as string,
    title: row.title as string,
    message: row.message as string,
    entityType: row.entity_type as string,
    entityId: row.entity_id as string,
    isRead: Boolean(row.is_read),
    priority: row.priority as AppNotification['priority'],
    createdAt: row.created_at as string,
  }
}

/**
 * Row visibility is enforced by RLS (own notifications, plus organization-wide
 * ones for HR members), so the query itself stays a plain ordered select.
 */
export async function fetchMyNotifications(
  currentUser: Profile,
): Promise<AppNotification[]> {
  if (!isSupabaseConfigured || !supabase) {
    return mockDb.getNotificationsForUser(currentUser)
  }

  const { data, error } = await supabase
    .from('notifications')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) throw error
  return (data ?? []).map(mapNotification)
}

export async function markNotificationRead(
  currentUser: Profile,
  notificationId: string,
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    mockDb.markNotificationRead(currentUser, notificationId)
    return
  }

  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('id', notificationId)
  if (error) throw error
}

export async function markAllNotificationsRead(
  currentUser: Profile,
): Promise<void> {
  if (!isSupabaseConfigured || !supabase) {
    mockDb.markAllNotificationsRead(currentUser)
    return
  }

  // RLS scopes the update to the notifications this user can already see.
  const { error } = await supabase
    .from('notifications')
    .update({ is_read: true })
    .eq('is_read', false)
  if (error) throw error
}
