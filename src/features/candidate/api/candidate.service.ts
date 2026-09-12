import { mockDb } from '@/lib/api/mock-db'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import type {
  CandidateProfile,
  CandidateSearchFilters,
  ContactRequest,
  TalentDocument,
  DocumentType,
} from '@/types/domain'
import { emptyCareerPreferences } from '../passport'
import {
  buildCandidateDocumentPath,
  validateCvFile,
} from '../cv-workflow'

const DOCUMENT_SIGNED_URL_TTL_SECONDS = 60 * 60

type CandidateProfilePatch = Partial<
  Pick<
    CandidateProfile,
    | 'headline'
    | 'location'
    | 'bio'
    | 'skills'
    | 'structuredSkills'
    | 'education'
    | 'experience'
    | 'languages'
    | 'projects'
    | 'sehTraining'
    | 'credentials'
    | 'careerPreferences'
    | 'linkedinUrl'
    | 'employerVisible'
  >
>

function readArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : []
}

interface CandidateProfileRow {
  user_id: string
  seh_talent_id: string | null
  headline: string | null
  location: string | null
  bio: string | null
  skills: string[] | null
  structured_skills: unknown
  education: unknown
  experience: unknown
  languages: unknown
  projects: unknown
  seh_training: unknown
  credentials: unknown
  career_preferences: Partial<CandidateProfile['careerPreferences']> | null
  linkedin_url: string | null
  employer_visible: boolean | null
  verification_status: CandidateProfile['verificationStatus']
  verified_at: string | null
  rejection_reason: string | null
  updated_at: string
  profiles?: {
    full_name: string | null
    email: string
    avatar_url: string | null
  } | null
}

function mapProfile(data: CandidateProfileRow): CandidateProfile {
  return {
    userId: data.user_id,
    sehTalentId: data.seh_talent_id ?? null,
    headline: data.headline,
    location: data.location,
    bio: data.bio,
    skills: data.skills ?? [],
    structuredSkills: readArray(data.structured_skills),
    education: readArray(data.education),
    experience: readArray(data.experience),
    languages: readArray(data.languages),
    projects: readArray(data.projects),
    sehTraining: readArray(data.seh_training),
    credentials: readArray(data.credentials),
    careerPreferences: {
      ...emptyCareerPreferences,
      ...(data.career_preferences ?? {}),
    },
    linkedinUrl: data.linkedin_url ?? null,
    employerVisible: Boolean(data.employer_visible),
    verificationStatus: data.verification_status,
    verifiedAt: data.verified_at,
    rejectionReason: data.rejection_reason,
    updatedAt: data.updated_at,
    profile: data.profiles
      ? {
          fullName: data.profiles.full_name,
          email: data.profiles.email,
          avatarUrl: data.profiles.avatar_url,
        }
      : undefined,
  }
}

async function createDocumentUrl(storagePath: string): Promise<string | null> {
  if (!supabase) return null
  const { data, error } = await supabase.storage
    .from('candidate-documents')
    .createSignedUrl(storagePath, DOCUMENT_SIGNED_URL_TTL_SECONDS)
  if (error) return null
  return data.signedUrl
}

export const candidateService = {
  async getMyProfile(userId: string): Promise<CandidateProfile> {
    if (!isSupabaseConfigured) {
      const profile = mockDb.getCandidate(userId)
      if (!profile) throw new Error('Profile not found')
      return profile
    }
    const { data, error } = await supabase!
      .from('candidate_profiles')
      .select('*, profiles(full_name, email, avatar_url)')
      .eq('user_id', userId)
      .single()
    if (error) throw error
    return mapProfile(data)
  },

  async updateProfile(
    userId: string,
    patch: CandidateProfilePatch,
  ): Promise<CandidateProfile> {
    if (!isSupabaseConfigured) {
      return mockDb.updateCandidate(userId, patch)
    }
    const { error } = await supabase!
      .from('candidate_profiles')
      .update({
        headline: patch.headline,
        location: patch.location,
        bio: patch.bio,
        skills: patch.skills,
        structured_skills: patch.structuredSkills,
        education: patch.education,
        experience: patch.experience,
        languages: patch.languages,
        projects: patch.projects,
        seh_training: patch.sehTraining,
        credentials: patch.credentials,
        career_preferences: patch.careerPreferences,
        linkedin_url: patch.linkedinUrl,
        employer_visible: patch.employerVisible,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
    if (error) throw error
    return this.getMyProfile(userId)
  },

  async submitForVerification(userId: string): Promise<void> {
    if (!isSupabaseConfigured) {
      mockDb.submitForVerification(userId)
      return
    }
    const { error } = await supabase!
      .from('candidate_profiles')
      .update({ verification_status: 'pending' })
      .eq('user_id', userId)
    if (error) throw error

    // Same notifications the mock raises: the candidate plus every admin.
    const { error: notifyError } = await supabase!.rpc('notify_verification_submitted')
    if (notifyError) throw notifyError
  },

  async getDocuments(userId: string): Promise<TalentDocument[]> {
    if (!isSupabaseConfigured) {
      return mockDb.getDocuments(userId).map((d) => ({
        ...d,
        publicUrl: mockDb.getDocumentPublicUrl(d),
      }))
    }
    const { data, error } = await supabase!
      .from('documents')
      .select('*')
      .eq('candidate_id', userId)
      .order('uploaded_at', { ascending: false })
    if (error) throw error
    return Promise.all(
      (data ?? []).map(async (d) => ({
        id: d.id,
        candidateId: d.candidate_id,
        type: d.type,
        fileName: d.file_name,
        storagePath: d.storage_path,
        mimeType: d.mime_type,
        fileSize: d.file_size,
        uploadedAt: d.uploaded_at,
        publicUrl: await createDocumentUrl(d.storage_path),
      })),
    )
  },

  async uploadDocument(
    userId: string,
    file: File,
    type: DocumentType,
  ): Promise<TalentDocument> {
    if (!isSupabaseConfigured) {
      return mockDb.addDocument(userId, {
        type,
        fileName: file.name,
        storagePath: `mock/${userId}/${file.name}`,
        mimeType: file.type,
        fileSize: file.size,
      })
    }
    if (type === 'cv') {
      const validation = validateCvFile(file)
      if (!validation.ok) throw new Error(validation.message ?? 'Invalid CV file.')
    }

    const path = buildCandidateDocumentPath(userId, type, file.name)
    const { error: uploadError } = await supabase!.storage
      .from('candidate-documents')
      .upload(path, file)
    if (uploadError) throw uploadError

    const { data, error } = await supabase!
      .from('documents')
      .insert({
        candidate_id: userId,
        type,
        file_name: file.name,
        storage_path: path,
        mime_type: file.type,
        file_size: file.size,
      })
      .select()
      .single()
    if (error) {
      await supabase!.storage.from('candidate-documents').remove([path])
      throw error
    }
    return {
      id: data.id,
      candidateId: data.candidate_id,
      type: data.type,
      fileName: data.file_name,
      storagePath: data.storage_path,
      mimeType: data.mime_type,
      fileSize: data.file_size,
      uploadedAt: data.uploaded_at,
      publicUrl: await createDocumentUrl(data.storage_path),
    }
  },

  async replaceCvDocument(
    userId: string,
    currentDocumentId: string,
    file: File,
  ): Promise<TalentDocument> {
    if (!isSupabaseConfigured) {
      const next = mockDb.addDocument(userId, {
        type: 'cv',
        fileName: file.name,
        storagePath: `mock/${userId}/${file.name}`,
        mimeType: file.type,
        fileSize: file.size,
        publicUrl: mockDb.getDocumentPublicUrl({
          id: 'pending',
          candidateId: userId,
          type: 'cv',
          fileName: file.name,
          storagePath: `mock/${userId}/${file.name}`,
          mimeType: file.type,
          fileSize: file.size,
          uploadedAt: new Date().toISOString(),
        }),
      })
      mockDb.deleteDocument(userId, currentDocumentId)
      return next
    }

    const { data: current, error: currentError } = await supabase!
      .from('documents')
      .select('id, storage_path')
      .eq('id', currentDocumentId)
      .eq('candidate_id', userId)
      .eq('type', 'cv')
      .maybeSingle()
    if (currentError) throw currentError
    if (!current) throw new Error('Current CV was not found.')

    const next = await this.uploadDocument(userId, file, 'cv')
    const { error: storageError } = await supabase!.storage
      .from('candidate-documents')
      .remove([current.storage_path])
    if (storageError) throw storageError

    const { error: deleteError } = await supabase!
      .from('documents')
      .delete()
      .eq('id', current.id)
      .eq('candidate_id', userId)
      .eq('type', 'cv')
    if (deleteError) throw deleteError

    return next
  },

  async deleteDocument(userId: string, documentId: string): Promise<void> {
    if (!isSupabaseConfigured) {
      mockDb.deleteDocument(userId, documentId)
      return
    }
    const { data: document, error: readError } = await supabase!
      .from('documents')
      .select('id, storage_path')
      .eq('id', documentId)
      .eq('candidate_id', userId)
      .maybeSingle()
    if (readError) throw readError
    if (!document) throw new Error('Document not found.')

    const { error: storageError } = await supabase!.storage
      .from('candidate-documents')
      .remove([document.storage_path])
    if (storageError) throw storageError

    const { error } = await supabase!
      .from('documents')
      .delete()
      .eq('id', documentId)
      .eq('candidate_id', userId)
    if (error) throw error
  },

  async getContactRequests(userId: string): Promise<ContactRequest[]> {
    if (!isSupabaseConfigured) return mockDb.getContactRequestsForCandidate(userId)
    const { data, error } = await supabase!
      .from('contact_requests')
      .select('*, hr:profiles!hr_user_id(full_name), organization:hr_organizations(name)')
      .eq('candidate_id', userId)
      .order('created_at', { ascending: false })
    if (error) throw error
    return (data ?? []).map((r) => ({
      id: r.id,
      hrUserId: r.hr_user_id,
      candidateId: r.candidate_id,
      organizationId: r.organization_id,
      message: r.message,
      status: r.status,
      createdAt: r.created_at,
      hrName: r.hr?.full_name,
      organizationName: r.organization?.name,
    }))
  },

  async respondToContact(
    userId: string,
    requestId: string,
    status: 'accepted' | 'declined',
  ): Promise<void> {
    if (!isSupabaseConfigured) {
      mockDb.respondContactRequest(requestId, userId, status)
      return
    }
    const { error } = await supabase!
      .from('contact_requests')
      .update({ status })
      .eq('id', requestId)
      .eq('candidate_id', userId)
    if (error) throw error
  },

  searchVerified(filters: CandidateSearchFilters): CandidateProfile[] {
    if (!isSupabaseConfigured) return mockDb.searchVerifiedCandidates(filters)
    throw new Error('Use hrService.searchCandidates with Supabase')
  },
}
