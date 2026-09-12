import { mockDb } from '@/lib/api/mock-db'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import type { CandidateProfile, CandidateRecord } from '@/types/domain'

const CV_SIGNED_URL_TTL_SECONDS = 60 * 60

function mapRow(row: Record<string, unknown>): CandidateRecord {
  return {
    id: row.id as string,
    sehTalentId: (row.seh_talent_id as string | null) ?? null,
    name: row.name as string,
    email: row.email as string,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    cvUrl: (row.cv_url as string | null) ?? null,
    skills: (row.skills as string[]) ?? [],
    structuredSkills: (row.structured_skills as CandidateRecord['structuredSkills']) ?? [],
    experienceYears: (row.experience_years as number | null) ?? null,
    education: (row.education as string | null) ?? null,
    aiSummary: (row.ai_summary as string | null) ?? null,
    jobMatchScore: (row.job_match_score as number | null) ?? null,
    location: (row.location as string | null) ?? null,
    employerVisible: (row.employer_visible as boolean | null) ?? false,
    openToWork: (row.open_to_work as boolean | null) ?? false,
    employmentTypes: (row.employment_types as string[] | null) ?? [],
    preferredFields: (row.preferred_fields as string[] | null) ?? [],
    preferredLocations: (row.preferred_locations as string[] | null) ?? [],
    remotePreference: row.remote_preference as CandidateRecord['remotePreference'],
    availabilityTiming: row.availability_timing as CandidateRecord['availabilityTiming'],
  }
}

function firstEducation(profile: CandidateProfile): string | null {
  const education = profile.education[0]
  if (!education) return null
  return `${education.program}, ${education.institution}`
}

export const candidatesService = {
  async getById(id: string): Promise<CandidateRecord | null> {
    if (!isSupabaseConfigured || !supabase) {
      return mockDb.getCandidateRecord(id) ?? null
    }

    const { data, error } = await supabase
      .from('candidates')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    return data ? mapRow(data) : null
  },

  async syncFromProfile(userId: string): Promise<void> {
    if (!isSupabaseConfigured || !supabase) {
      mockDb.syncCandidateRecord(userId)
      return
    }
    const { data: candidate, error: candidateError } = await supabase
      .from('candidate_profiles')
      .select('*, profiles(full_name, email, avatar_url)')
      .eq('user_id', userId)
      .single()
    if (candidateError) throw candidateError

    const { data: latestCv, error: cvError } = await supabase
      .from('documents')
      .select('storage_path')
      .eq('candidate_id', userId)
      .eq('type', 'cv')
      .order('uploaded_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    if (cvError) throw cvError

    const signedCv = latestCv
      ? await supabase.storage
          .from('candidate-documents')
          .createSignedUrl(latestCv.storage_path, CV_SIGNED_URL_TTL_SECONDS)
      : null
    const cvUrl = signedCv && !signedCv.error ? signedCv.data.signedUrl : null

    const profile = {
      userId,
      sehTalentId: candidate.seh_talent_id ?? null,
      headline: candidate.headline,
      location: candidate.location,
      bio: candidate.bio,
      skills: candidate.skills ?? [],
      structuredSkills: candidate.structured_skills ?? [],
      education: candidate.education ?? [],
      experience: candidate.experience ?? [],
      languages: candidate.languages ?? [],
      projects: candidate.projects ?? [],
      sehTraining: candidate.seh_training ?? [],
      credentials: candidate.credentials ?? [],
      careerPreferences: candidate.career_preferences,
      linkedinUrl: candidate.linkedin_url ?? null,
      employerVisible: Boolean(candidate.employer_visible),
      verificationStatus: candidate.verification_status,
      verifiedAt: candidate.verified_at,
      rejectionReason: candidate.rejection_reason,
      updatedAt: candidate.updated_at,
    } as CandidateProfile

    const { error } = await supabase.from('candidates').upsert({
      id: userId,
      seh_talent_id: candidate.seh_talent_id,
      name: candidate.profiles?.full_name ?? candidate.profiles?.email ?? 'Candidate',
      email: candidate.profiles?.email ?? '',
      avatar_url: candidate.profiles?.avatar_url ?? null,
      cv_url: cvUrl,
      skills: candidate.skills ?? [],
      structured_skills: candidate.structured_skills ?? [],
      experience_years: null,
      education: firstEducation(profile),
      ai_summary: candidate.bio
        ? `${candidate.headline ?? 'Candidate'}: ${candidate.bio}`
        : null,
      job_match_score: candidate.verification_status === 'verified' ? 85 : null,
      location: candidate.location,
      employer_visible: Boolean(candidate.employer_visible),
      open_to_work: Boolean(candidate.career_preferences?.openToWork),
      employment_types: candidate.career_preferences?.employmentTypes ?? [],
      preferred_fields: candidate.career_preferences?.preferredFields ?? [],
      preferred_locations: candidate.career_preferences?.preferredLocations ?? [],
      remote_preference: candidate.career_preferences?.remotePreference ?? 'flexible',
      availability_timing: candidate.career_preferences?.availabilityTiming ?? 'immediate',
      updated_at: new Date().toISOString(),
    })
    if (error) throw error
  },
}
