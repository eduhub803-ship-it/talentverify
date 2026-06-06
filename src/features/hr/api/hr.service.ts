import { mockDb } from '@/lib/api/mock-db'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import type {
  CandidateProfile,
  CandidateSearchFilters,
  ContactRequest,
  HrMember,
} from '@/types/domain'

export const hrService = {
  async getMembership(userId: string): Promise<HrMember | null> {
    if (!isSupabaseConfigured) return mockDb.getHrMember(userId) ?? null

    const { data, error } = await supabase!
      .from('hr_members')
      .select('*, organization:hr_organizations(*)')
      .eq('user_id', userId)
      .single()
    if (error) return null
    return {
      userId: data.user_id,
      organizationId: data.organization_id,
      isOwner: data.is_owner,
      organization: data.organization
        ? {
            id: data.organization.id,
            name: data.organization.name,
            website: data.organization.website,
            industry: data.organization.industry,
            status: data.organization.status,
            approvedAt: data.organization.approved_at,
            createdAt: data.organization.created_at,
          }
        : undefined,
    }
  },

  searchCandidates(filters: CandidateSearchFilters): CandidateProfile[] {
    if (!isSupabaseConfigured) return mockDb.searchVerifiedCandidates(filters)
    throw new Error('Async Supabase search not wired in demo — use mock mode')
  },

  getVerifiedCandidate(userId: string): CandidateProfile | undefined {
    if (!isSupabaseConfigured) {
      const c = mockDb.getCandidate(userId)
      if (!c || c.verificationStatus !== 'verified') return undefined
      return c
    }
    return undefined
  },

  sendContactRequest(input: {
    hrUserId: string
    candidateId: string
    organizationId: string
    message: string
  }): ContactRequest {
    if (!isSupabaseConfigured) return mockDb.sendContactRequest(input)
    throw new Error('Use Supabase in production')
  },
}
