import { mockDb } from '@/lib/api/mock-db'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import type {
  CandidateCareerPreferences,
  CandidateDirectoryEntry,
  CandidateImportBatch,
  ImportedCandidate,
  ImportedCandidateData,
  ImportedCandidateStatus,
} from '@/types/domain'
import { emptyCareerPreferences } from '@/features/candidate/passport'
import { normalizeEmail } from '../import/normalize'

export interface ImportCandidatesInput {
  fileName: string
  importedBy: string
  rows: { rowNumber: number; data: ImportedCandidateData }[]
  skippedDuplicateCount: number
  conflictCount: number
  errorCount: number
  totalRows: number
}

export interface ImportCandidatesResult {
  batch: CandidateImportBatch
  created: ImportedCandidate[]
  /** Emails rejected at write time because another row won the race. */
  skipped: string[]
}

interface ImportedCandidateRow {
  id: string
  batch_id: string
  full_name: string
  email: string
  normalized_email: string
  phone: string | null
  location: string | null
  headline: string | null
  bio: string | null
  skills: string[] | null
  structured_skills: unknown
  languages: unknown
  education: unknown
  experience: unknown
  seh_training: unknown
  career_preferences: Partial<CandidateCareerPreferences> | null
  linkedin_url: string | null
  notes: string | null
  status: ImportedCandidateStatus
  claimed_user_id: string | null
  claimed_at: string | null
  source_row_number: number | null
  created_at: string
  updated_at: string
}

interface ImportBatchRow {
  id: string
  file_name: string
  imported_by: string | null
  created_at: string
  total_rows: number | null
  created_count: number | null
  skipped_duplicate_count: number | null
  conflict_count: number | null
  error_count: number | null
}

function readArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

function mapImported(row: ImportedCandidateRow): ImportedCandidate {
  return {
    id: row.id,
    batchId: row.batch_id,
    fullName: row.full_name,
    email: row.email,
    normalizedEmail: row.normalized_email,
    phone: row.phone ?? null,
    location: row.location ?? null,
    headline: row.headline ?? null,
    bio: row.bio ?? null,
    skills: row.skills ?? [],
    structuredSkills: readArray(row.structured_skills),
    languages: readArray(row.languages),
    education: readArray(row.education),
    experience: readArray(row.experience),
    sehTraining: readArray(row.seh_training),
    careerPreferences: { ...emptyCareerPreferences, ...(row.career_preferences ?? {}) },
    linkedinUrl: row.linkedin_url ?? null,
    notes: row.notes ?? null,
    status: row.status,
    claimedUserId: row.claimed_user_id ?? null,
    claimedAt: row.claimed_at ?? null,
    sourceRowNumber: row.source_row_number ?? 0,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapBatch(row: ImportBatchRow): CandidateImportBatch {
  return {
    id: row.id,
    fileName: row.file_name,
    importedBy: row.imported_by ?? '',
    createdAt: row.created_at,
    totalRows: row.total_rows ?? 0,
    createdCount: row.created_count ?? 0,
    skippedDuplicateCount: row.skipped_duplicate_count ?? 0,
    conflictCount: row.conflict_count ?? 0,
    errorCount: row.error_count ?? 0,
  }
}

function toRow(batchId: string, rowNumber: number, data: ImportedCandidateData) {
  return {
    batch_id: batchId,
    full_name: data.fullName,
    email: data.email,
    normalized_email: data.normalizedEmail,
    phone: data.phone,
    location: data.location,
    headline: data.headline,
    bio: data.bio,
    skills: data.skills,
    structured_skills: data.structuredSkills,
    languages: data.languages,
    education: data.education,
    experience: data.experience,
    seh_training: data.sehTraining,
    career_preferences: data.careerPreferences,
    linkedin_url: data.linkedinUrl,
    notes: data.notes,
    status: 'imported',
    source_row_number: rowNumber,
  }
}

export const candidateImportService = {
  /** Every email already known to the platform, used for duplicate detection. */
  async getDirectory(): Promise<CandidateDirectoryEntry[]> {
    if (!isSupabaseConfigured || !supabase) return mockDb.getCandidateDirectory()

    const [{ data: profiles, error: profilesError }, { data: roster, error: rosterError }] =
      await Promise.all([
        supabase.from('profiles').select('id, email, full_name, role'),
        supabase.from('imported_candidates').select('*'),
      ])
    if (profilesError) throw profilesError
    if (rosterError) throw rosterError

    const registered: CandidateDirectoryEntry[] = (profiles ?? []).map((profile) => ({
      normalizedEmail: normalizeEmail(profile.email),
      source: 'registered',
      id: profile.id,
      fullName: profile.full_name,
      role: profile.role,
      status: null,
      data: null,
    }))

    const imported: CandidateDirectoryEntry[] = (roster ?? []).map((row) => {
      const record = mapImported(row)
      return {
        normalizedEmail: record.normalizedEmail,
        source: 'imported',
        id: record.id,
        fullName: record.fullName,
        role: 'candidate',
        status: record.status,
        data: record,
      }
    })

    const seen = new Set<string>()
    return [...registered, ...imported].filter((entry) => {
      if (!entry.normalizedEmail || seen.has(entry.normalizedEmail)) return false
      seen.add(entry.normalizedEmail)
      return true
    })
  },

  /**
   * Writes the validated rows. The unique index on `normalized_email` is the
   * final authority: rows that collide are skipped, never merged or updated.
   */
  async importCandidates(input: ImportCandidatesInput): Promise<ImportCandidatesResult> {
    if (!isSupabaseConfigured || !supabase) return mockDb.importCandidates(input)

    const { data: batchRow, error: batchError } = await supabase
      .from('candidate_import_batches')
      .insert({
        file_name: input.fileName,
        imported_by: input.importedBy,
        total_rows: input.totalRows,
        created_count: 0,
        skipped_duplicate_count: input.skippedDuplicateCount,
        conflict_count: input.conflictCount,
        error_count: input.errorCount,
      })
      .select()
      .single()
    if (batchError) throw batchError

    const batchId = batchRow.id as string
    let created: ImportedCandidate[] = []

    if (input.rows.length > 0) {
      const { data, error } = await supabase
        .from('imported_candidates')
        .upsert(
          input.rows.map((row) => toRow(batchId, row.rowNumber, row.data)),
          { onConflict: 'normalized_email', ignoreDuplicates: true },
        )
        .select()
      if (error) throw error
      created = (data ?? []).map(mapImported)
    }

    const createdEmails = new Set(created.map((row) => row.normalizedEmail))
    const skipped = input.rows
      .filter((row) => !createdEmails.has(row.data.normalizedEmail))
      .map((row) => row.data.email)

    const { data: finalBatch, error: updateError } = await supabase
      .from('candidate_import_batches')
      .update({
        created_count: created.length,
        skipped_duplicate_count: input.skippedDuplicateCount + skipped.length,
      })
      .eq('id', batchId)
      .select()
      .single()
    if (updateError) throw updateError

    return { batch: mapBatch(finalBatch), created, skipped }
  },

  async listImportedCandidates(batchId?: string): Promise<ImportedCandidate[]> {
    if (!isSupabaseConfigured || !supabase) return mockDb.listImportedCandidates(batchId)

    let query = supabase
      .from('imported_candidates')
      .select('*')
      .order('created_at', { ascending: false })
    if (batchId) query = query.eq('batch_id', batchId)

    const { data, error } = await query
    if (error) throw error
    return (data ?? []).map(mapImported)
  },

  async listImportBatches(): Promise<CandidateImportBatch[]> {
    if (!isSupabaseConfigured || !supabase) return mockDb.listCandidateImportBatches()

    const { data, error } = await supabase
      .from('candidate_import_batches')
      .select('*')
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map(mapBatch)
  },
}
