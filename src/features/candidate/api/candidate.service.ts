import { mockDb } from '@/lib/api/mock-db'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import type {
  CandidateProfile,
  CandidateSearchFilters,
  ContactRequest,
  TalentDocument,
  DocumentType,
} from '@/types/domain'

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
    return {
      userId: data.user_id,
      headline: data.headline,
      location: data.location,
      bio: data.bio,
      skills: data.skills ?? [],
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
  },

  async updateProfile(
    userId: string,
    patch: Partial<Pick<CandidateProfile, 'headline' | 'location' | 'bio' | 'skills'>>,
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
    return (data ?? []).map((d) => ({
      id: d.id,
      candidateId: d.candidate_id,
      type: d.type,
      fileName: d.file_name,
      storagePath: d.storage_path,
      mimeType: d.mime_type,
      fileSize: d.file_size,
      uploadedAt: d.uploaded_at,
    }))
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
    const path = `${userId}/${type}/${Date.now()}-${file.name}`
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
    if (error) throw error
    return {
      id: data.id,
      candidateId: data.candidate_id,
      type: data.type,
      fileName: data.file_name,
      storagePath: data.storage_path,
      mimeType: data.mime_type,
      fileSize: data.file_size,
      uploadedAt: data.uploaded_at,
    }
  },

  async deleteDocument(userId: string, documentId: string): Promise<void> {
    if (!isSupabaseConfigured) {
      mockDb.deleteDocument(userId, documentId)
      return
    }
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
