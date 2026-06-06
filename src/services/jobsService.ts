import { mockDb } from '@/lib/api/mock-db'
import { isSupabaseConfigured, supabase } from '@/lib/supabase/client'
import type {
  ApplicationStatus,
  CandidateJobApplicationContext,
  CandidateRecord,
  Job,
  JobApplication,
} from '@/types/domain'

interface CreateJobInput {
  title: string
  description: string
  requirements: string[]
  experienceLevel?: string | null
  location: string
  jobType: string
  createdBy: string
}

interface ApplyToJobInput {
  jobId: string
  candidateId: string
  message?: string | null
  cvFile?: File | null
  useExistingCv?: boolean
}

const APPLICATION_SELECT =
  '*, candidate:candidate_profiles(user_id, headline, location, bio, skills, profile:profiles(full_name, email, avatar_url))'

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object'
    ? (value as Record<string, unknown>)
    : null
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function mapJob(row: Record<string, unknown>): Job {
  return {
    id: row.id as string,
    title: row.title as string,
    description: row.description as string,
    requirements: asStringArray(row.requirements),
    experienceLevel: (row.experience_level as string | null) ?? null,
    location: row.location as string,
    jobType: row.job_type as string,
    status: row.status as Job['status'],
    createdBy: row.created_by as string,
    createdAt: row.created_at as string,
  }
}

function mapCandidateFromApplication(
  row: Record<string, unknown> | null,
  cvUrl: string | null,
): CandidateRecord | null {
  if (!row) return null
  const profile = asRecord(row.profile)
  const name = (profile?.full_name as string | null) ?? 'Candidate'
  const email = (profile?.email as string | null) ?? ''
  const headline = (row.headline as string | null) ?? null
  const bio = (row.bio as string | null) ?? null

  return {
    id: row.user_id as string,
    name,
    email,
    cvUrl,
    skills: asStringArray(row.skills),
    experienceYears: null,
    education: null,
    aiSummary: bio
      ? `${headline ?? 'Applicant'}: ${bio}`
      : headline,
    jobMatchScore: null,
    location: (row.location as string | null) ?? null,
  }
}

function mapApplication(row: Record<string, unknown>): JobApplication {
  const cvUrl = (row.cv_url as string | null) ?? null
  return {
    id: row.id as string,
    jobId: row.job_id as string,
    candidateId: row.candidate_id as string,
    cvUrl,
    message: (row.message as string | null) ?? null,
    status: row.status as ApplicationStatus,
    createdAt: row.created_at as string,
    candidate: mapCandidateFromApplication(asRecord(row.candidate), cvUrl),
  }
}

async function getLatestCvUrl(candidateId: string): Promise<{
  url: string | null
  fileName: string | null
}> {
  if (!isSupabaseConfigured || !supabase) {
    const context = mockDb.getCandidateJobApplicationContext(candidateId)
    return { url: context.existingCvUrl, fileName: context.existingCvName }
  }

  const { data, error } = await supabase
    .from('documents')
    .select('file_name, storage_path')
    .eq('candidate_id', candidateId)
    .eq('type', 'cv')
    .order('uploaded_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (error) throw error
  if (!data) return { url: null, fileName: null }

  const { data: urlData } = supabase.storage
    .from('candidate-documents')
    .getPublicUrl(data.storage_path)

  return { url: urlData.publicUrl, fileName: data.file_name }
}

async function uploadApplicationCv(candidateId: string, file: File): Promise<string> {
  if (!isSupabaseConfigured || !supabase) {
    throw new Error('Mock CV uploads are handled by the mock application flow.')
  }

  const path = `${candidateId}/applications/${Date.now()}-${file.name}`
  const { error: uploadError } = await supabase.storage
    .from('candidate-documents')
    .upload(path, file)

  if (uploadError) throw uploadError

  const { error: documentError } = await supabase.from('documents').insert({
    candidate_id: candidateId,
    type: 'cv',
    file_name: file.name,
    storage_path: path,
    mime_type: file.type,
    file_size: file.size,
  })

  if (documentError) throw documentError

  const { data } = supabase.storage.from('candidate-documents').getPublicUrl(path)
  return data.publicUrl
}

export const jobsService = {
  async listHrJobs(createdBy: string): Promise<Job[]> {
    if (!isSupabaseConfigured || !supabase) return mockDb.listJobs(createdBy)

    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('created_by', createdBy)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map((row) => mapJob(row))
  },

  async listOpenJobs(): Promise<Job[]> {
    if (!isSupabaseConfigured || !supabase) return mockDb.listOpenJobs()

    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('status', 'open')
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map((row) => mapJob(row))
  },

  async getJob(id: string): Promise<Job | null> {
    if (!isSupabaseConfigured || !supabase) return mockDb.getJob(id) ?? null

    const { data, error } = await supabase
      .from('jobs')
      .select('*')
      .eq('id', id)
      .maybeSingle()

    if (error) throw error
    return data ? mapJob(data) : null
  },

  async createJob(input: CreateJobInput): Promise<Job> {
    if (!isSupabaseConfigured || !supabase) return mockDb.createJob(input)

    const { data, error } = await supabase
      .from('jobs')
      .insert({
        title: input.title,
        description: input.description,
        requirements: input.requirements,
        experience_level: input.experienceLevel,
        location: input.location,
        job_type: input.jobType,
        status: 'open',
        created_by: input.createdBy,
      })
      .select()
      .single()

    if (error) throw error
    return mapJob(data)
  },

  async getApplicationsForJob(jobId: string): Promise<JobApplication[]> {
    if (!isSupabaseConfigured || !supabase) return mockDb.getApplicationsForJob(jobId)

    const { data, error } = await supabase
      .from('applications')
      .select(APPLICATION_SELECT)
      .eq('job_id', jobId)
      .order('created_at', { ascending: false })

    if (error) throw error
    return (data ?? []).map((row) => mapApplication(row))
  },

  async updateApplicationStatus(
    applicationId: string,
    status: ApplicationStatus,
  ): Promise<JobApplication> {
    if (!isSupabaseConfigured || !supabase) {
      return mockDb.updateApplicationStatus(applicationId, status)
    }

    const { data, error } = await supabase
      .from('applications')
      .update({ status })
      .eq('id', applicationId)
      .select(APPLICATION_SELECT)
      .single()

    if (error) throw error
    return mapApplication(data)
  },

  async getCandidateApplicationContext(
    candidateId: string,
  ): Promise<CandidateJobApplicationContext> {
    if (!isSupabaseConfigured || !supabase) {
      return mockDb.getCandidateJobApplicationContext(candidateId)
    }

    const [{ url, fileName }, { data, error }] = await Promise.all([
      getLatestCvUrl(candidateId),
      supabase
        .from('applications')
        .select('job_id')
        .eq('candidate_id', candidateId),
    ])

    if (error) throw error

    return {
      existingCvUrl: url,
      existingCvName: fileName,
      appliedJobIds: (data ?? []).map((row) => row.job_id as string),
    }
  },

  async applyToJob(input: ApplyToJobInput): Promise<JobApplication> {
    if (!isSupabaseConfigured || !supabase) return mockDb.applyToJob(input)

    const job = await this.getJob(input.jobId)
    if (!job || job.status !== 'open') throw new Error('This job is not open.')

    let cvUrl: string | null = null
    if (input.cvFile) {
      cvUrl = await uploadApplicationCv(input.candidateId, input.cvFile)
    } else if (input.useExistingCv) {
      cvUrl = (await getLatestCvUrl(input.candidateId)).url
    }

    if (!cvUrl) throw new Error('Add a CV before applying to this job.')

    const { data, error } = await supabase
      .from('applications')
      .insert({
        job_id: input.jobId,
        candidate_id: input.candidateId,
        cv_url: cvUrl,
        message: input.message?.trim() || null,
        status: 'pending',
      })
      .select(APPLICATION_SELECT)
      .single()

    if (error) throw error
    return mapApplication(data)
  },
}
