import { mockDb } from '@/lib/api/mock-db'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import type {
  CandidateProfile,
  CandidateSearchFilters,
  ContactRequest,
  HrMember,
} from '@/types/domain'

function escapeLike(value: string): string {
  return value.trim().replaceAll('%', '\\%').replaceAll('_', '\\_')
}

function mapCandidateProfile(row: Record<string, unknown>): CandidateProfile {
  const profile = row.profile as
    | { full_name?: string | null; email?: string | null; avatar_url?: string | null }
    | null
    | undefined

  return {
    userId: row.user_id as string,
    sehTalentId: (row.seh_talent_id as string | null) ?? null,
    headline: (row.headline as string | null) ?? null,
    location: (row.location as string | null) ?? null,
    bio: (row.bio as string | null) ?? null,
    skills: Array.isArray(row.skills) ? (row.skills as string[]) : [],
    structuredSkills: Array.isArray(row.structured_skills)
      ? (row.structured_skills as CandidateProfile['structuredSkills'])
      : [],
    education: Array.isArray(row.education) ? (row.education as CandidateProfile['education']) : [],
    experience: Array.isArray(row.experience)
      ? (row.experience as CandidateProfile['experience'])
      : [],
    languages: Array.isArray(row.languages) ? (row.languages as CandidateProfile['languages']) : [],
    projects: Array.isArray(row.projects) ? (row.projects as CandidateProfile['projects']) : [],
    sehTraining: Array.isArray(row.seh_training)
      ? (row.seh_training as CandidateProfile['sehTraining'])
      : [],
    credentials: Array.isArray(row.credentials)
      ? (row.credentials as CandidateProfile['credentials'])
      : [],
    careerPreferences: {
      openToWork: true,
      employmentTypes: [],
      preferredFields: [],
      preferredLocations: [],
      remotePreference: 'flexible',
      availabilityTiming: 'immediate',
      ...((row.career_preferences as CandidateProfile['careerPreferences'] | null) ?? {}),
    },
    linkedinUrl: (row.linkedin_url as string | null) ?? null,
    employerVisible: Boolean(row.employer_visible),
    verificationStatus: row.verification_status as CandidateProfile['verificationStatus'],
    verifiedAt: (row.verified_at as string | null) ?? null,
    rejectionReason: (row.rejection_reason as string | null) ?? null,
    updatedAt: row.updated_at as string,
    profile: profile
      ? {
          fullName: profile.full_name ?? null,
          email: profile.email ?? '',
          avatarUrl: profile.avatar_url ?? null,
        }
      : undefined,
  }
}

function mapContactRequest(row: Record<string, unknown>): ContactRequest {
  return {
    id: row.id as string,
    hrUserId: row.hr_user_id as string,
    candidateId: row.candidate_id as string,
    organizationId: row.organization_id as string,
    message: row.message as string,
    status: row.status as ContactRequest['status'],
    createdAt: row.created_at as string,
  }
}

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

  async searchCandidates(filters: CandidateSearchFilters): Promise<CandidateProfile[]> {
    if (!isSupabaseConfigured) return mockDb.searchVerifiedCandidates(filters)

    let query = supabase!
      .from('candidate_profiles')
      .select('*, profile:profiles(full_name, email, avatar_url)')
      .eq('verification_status', 'verified')
      .eq('employer_visible', true)

    if (filters.query?.trim()) {
      const value = escapeLike(filters.query)
      query = query.or(`headline.ilike.%${value}%,bio.ilike.%${value}%,location.ilike.%${value}%`)
    }
    if (filters.location?.trim()) {
      query = query.ilike('location', `%${escapeLike(filters.location)}%`)
    }
    if (filters.skills?.length) {
      query = query.contains('skills', filters.skills)
    }

    const { data, error } = await query.order('updated_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((row) => mapCandidateProfile(row))
  },

  async getVerifiedCandidate(userId: string): Promise<CandidateProfile | undefined> {
    if (!isSupabaseConfigured) {
      const c = mockDb.getCandidate(userId)
      if (!c || c.verificationStatus !== 'verified') return undefined
      return c
    }

    const { data, error } = await supabase!
      .from('candidate_profiles')
      .select('*, profile:profiles(full_name, email, avatar_url)')
      .eq('user_id', userId)
      .eq('verification_status', 'verified')
      .eq('employer_visible', true)
      .maybeSingle()
    if (error) throw error
    return data ? mapCandidateProfile(data) : undefined
  },

  async sendContactRequest(input: {
    hrUserId: string
    candidateId: string
    organizationId: string
    message: string
  }): Promise<ContactRequest> {
    if (!isSupabaseConfigured) return mockDb.sendContactRequest(input)

    const { data, error } = await supabase!
      .from('contact_requests')
      .insert({
        hr_user_id: input.hrUserId,
        candidate_id: input.candidateId,
        organization_id: input.organizationId,
        message: input.message.trim(),
        status: 'pending',
      })
      .select()
      .single()
    if (error) throw error

    // Same notifications the mock raises: the candidate plus the HR team.
    const { error: notifyError } = await supabase!.rpc('notify_contact_request', {
      target_request_id: data.id,
    })
    if (notifyError) throw notifyError

    return mapContactRequest(data)
  },

  async listShortlistedCandidateIds(
    hrUserId: string,
    organizationId: string,
  ): Promise<string[]> {
    if (!isSupabaseConfigured) {
      return mockDb.listShortlistedCandidateIds(hrUserId, organizationId)
    }

    const { data, error } = await supabase!
      .from('candidate_shortlists')
      .select('candidate_id')
      .eq('hr_user_id', hrUserId)
      .eq('organization_id', organizationId)
    if (error) throw error
    return (data ?? []).map((item) => item.candidate_id as string)
  },

  async toggleShortlist(input: {
    hrUserId: string
    candidateId: string
    organizationId: string
  }): Promise<{ shortlisted: boolean }> {
    if (!isSupabaseConfigured) return mockDb.toggleShortlist(input)

    const { data: existing, error: lookupError } = await supabase!
      .from('candidate_shortlists')
      .select('id')
      .eq('hr_user_id', input.hrUserId)
      .eq('candidate_id', input.candidateId)
      .eq('organization_id', input.organizationId)
      .maybeSingle()
    if (lookupError) throw lookupError

    if (existing) {
      const { error } = await supabase!
        .from('candidate_shortlists')
        .delete()
        .eq('id', existing.id)
      if (error) throw error
      return { shortlisted: false }
    }

    const { error } = await supabase!.from('candidate_shortlists').insert({
      hr_user_id: input.hrUserId,
      candidate_id: input.candidateId,
      organization_id: input.organizationId,
    })
    if (error) throw error
    return { shortlisted: true }
  },
}
