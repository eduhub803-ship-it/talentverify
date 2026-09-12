import { mockDb } from '@/lib/api/mock-db'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import { candidatesService } from '@/services/candidates.service'
import type {
  AdminStats,
  HrOrganization,
  VerificationQueueItem,
  VerificationStatus,
} from '@/types/domain'

const QUEUE_STATUSES: VerificationStatus[] = ['pending', 'under_review']

function mapOrganization(row: Record<string, unknown>): HrOrganization {
  return {
    id: row.id as string,
    name: row.name as string,
    website: (row.website as string | null) ?? null,
    industry: (row.industry as string | null) ?? null,
    status: row.status as HrOrganization['status'],
    approvedAt: (row.approved_at as string | null) ?? null,
    createdAt: row.created_at as string,
  }
}

/** `head: true` count query - no rows transferred, just the total. */
async function countRows(
  table: string,
  filter?: { column: string; equals?: string; oneOf?: string[] },
): Promise<number> {
  let query = supabase!.from(table).select('*', { count: 'exact', head: true })
  if (filter?.equals !== undefined) query = query.eq(filter.column, filter.equals)
  if (filter?.oneOf) query = query.in(filter.column, filter.oneOf)

  const { count, error } = await query
  if (error) throw error
  return count ?? 0
}

export const adminService = {
  async getStats(): Promise<AdminStats> {
    if (!isSupabaseConfigured || !supabase) return mockDb.getAdminStats()

    const [pendingVerifications, pendingHrOrgs, verifiedCandidates, totalCandidates] =
      await Promise.all([
        countRows('candidate_profiles', {
          column: 'verification_status',
          oneOf: QUEUE_STATUSES,
        }),
        countRows('hr_organizations', { column: 'status', equals: 'pending' }),
        countRows('candidate_profiles', {
          column: 'verification_status',
          equals: 'verified',
        }),
        countRows('candidate_profiles'),
      ])

    return { pendingVerifications, pendingHrOrgs, verifiedCandidates, totalCandidates }
  },

  async getVerificationQueue(): Promise<VerificationQueueItem[]> {
    if (!isSupabaseConfigured || !supabase) return mockDb.getVerificationQueue()

    const { data, error } = await supabase
      .from('candidate_profiles')
      .select(
        'user_id, headline, location, bio, linkedin_url, verification_status, updated_at, profile:profiles(full_name, email, avatar_url)',
      )
      .in('verification_status', QUEUE_STATUSES)
      .order('updated_at', { ascending: false })
    if (error) throw error

    const rows = data ?? []
    if (rows.length === 0) return []

    // Document counts in one round trip rather than per candidate.
    const candidateIds = rows.map((row) => row.user_id as string)
    const { data: documents, error: documentsError } = await supabase
      .from('documents')
      .select('candidate_id')
      .in('candidate_id', candidateIds)
    if (documentsError) throw documentsError

    const documentCounts = new Map<string, number>()
    for (const document of documents ?? []) {
      const key = document.candidate_id as string
      documentCounts.set(key, (documentCounts.get(key) ?? 0) + 1)
    }

    return rows.map((row) => {
      const profile = row.profile as
        | { full_name?: string | null; email?: string; avatar_url?: string | null }
        | null
      return {
        userId: row.user_id as string,
        fullName: profile?.full_name ?? 'Unknown',
        email: profile?.email ?? '',
        avatarUrl: profile?.avatar_url ?? null,
        headline: (row.headline as string | null) ?? null,
        location: (row.location as string | null) ?? null,
        bio: (row.bio as string | null) ?? null,
        linkedinUrl: (row.linkedin_url as string | null) ?? null,
        verificationStatus: row.verification_status as VerificationStatus,
        documentCount: documentCounts.get(row.user_id as string) ?? 0,
        updatedAt: row.updated_at as string,
      }
    })
  },

  /**
   * Approve / reject a candidate. The Supabase path runs one SECURITY DEFINER
   * routine that re-checks the admin role, writes the audit row in
   * `verification_reviews` and raises the notifications in a single
   * transaction - mirroring mockDb.reviewCandidate.
   */
  async reviewCandidate(
    userId: string,
    status: VerificationStatus,
    notes?: string,
  ): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      mockDb.reviewCandidate(userId, status, notes)
      return
    }

    const { error } = await supabase.rpc('admin_review_candidate', {
      target_user_id: userId,
      new_status: status,
      review_notes: notes ?? null,
    })
    if (error) throw error

    // Same follow-up the mock performs: refresh the HR-facing directory row
    // after any decision, so a reversed verification cannot leave stale data.
    await candidatesService.syncFromProfile(userId)
  },

  async getPendingHrOrgs(): Promise<HrOrganization[]> {
    if (!isSupabaseConfigured || !supabase) return mockDb.getPendingHrOrgs()

    const { data, error } = await supabase
      .from('hr_organizations')
      .select('*')
      .eq('status', 'pending')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(mapOrganization)
  },

  async getHrOrgs(): Promise<HrOrganization[]> {
    if (!isSupabaseConfigured || !supabase) return mockDb.getHrOrgs()

    const { data, error } = await supabase
      .from('hr_organizations')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(mapOrganization)
  },

  async reviewHrOrg(orgId: string, approved: boolean): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      mockDb.reviewHrOrg(orgId, approved)
      return
    }

    const { error } = await supabase.rpc('admin_review_hr_organization', {
      target_org_id: orgId,
      approved,
    })
    if (error) throw error
  },
}
