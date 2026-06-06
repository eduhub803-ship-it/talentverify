import { mockDb } from '@/lib/api/mock-db'
import { isSupabaseConfigured } from '@/lib/supabase/client'
import type {
  AdminStats,
  HrOrganization,
  VerificationQueueItem,
  VerificationStatus,
} from '@/types/domain'

export const adminService = {
  getStats(): AdminStats {
    if (!isSupabaseConfigured) return mockDb.getAdminStats()
    return {
      pendingVerifications: 0,
      pendingHrOrgs: 0,
      verifiedCandidates: 0,
      totalCandidates: 0,
    }
  },

  getVerificationQueue(): VerificationQueueItem[] {
    if (!isSupabaseConfigured) return mockDb.getVerificationQueue()
    return []
  },

  reviewCandidate(
    userId: string,
    status: VerificationStatus,
    notes?: string,
  ): void {
    if (!isSupabaseConfigured) {
      mockDb.reviewCandidate(userId, status, notes)
      return
    }
    throw new Error('Wire Supabase admin review in production')
  },

  getPendingHrOrgs(): HrOrganization[] {
    if (!isSupabaseConfigured) return mockDb.getPendingHrOrgs()
    return []
  },

  reviewHrOrg(orgId: string, approved: boolean): void {
    if (!isSupabaseConfigured) {
      mockDb.reviewHrOrg(orgId, approved)
    }
  },
}
