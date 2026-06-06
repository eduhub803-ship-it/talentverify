import { mockDb } from '@/lib/api/mock-db'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import type { CandidateRecord } from '@/types/domain'

function mapRow(row: Record<string, unknown>): CandidateRecord {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    cvUrl: (row.cv_url as string | null) ?? null,
    skills: (row.skills as string[]) ?? [],
    experienceYears: (row.experience_years as number | null) ?? null,
    education: (row.education as string | null) ?? null,
    aiSummary: (row.ai_summary as string | null) ?? null,
    jobMatchScore: (row.job_match_score as number | null) ?? null,
    location: (row.location as string | null) ?? null,
  }
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
    // Production: call edge function or RPC to upsert candidates row
  },
}
