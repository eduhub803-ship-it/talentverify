import { assertHrOrgApproved } from '@/features/hr/actions'
import { jobsService } from '@/services/jobsService'
import type {
  ApplicationStatus,
  CandidateJobApplicationContext,
  JobApplication,
} from '@/types/domain'

export async function fetchJobApplications(
  hrUserId: string,
  jobId: string,
): Promise<JobApplication[]> {
  await assertHrOrgApproved(hrUserId)
  return jobsService.getApplicationsForJob(jobId)
}

export async function updateJobApplicationStatus(
  hrUserId: string,
  applicationId: string,
  status: ApplicationStatus,
): Promise<JobApplication> {
  await assertHrOrgApproved(hrUserId)
  return jobsService.updateApplicationStatus(applicationId, status)
}

export async function fetchCandidateJobApplicationContext(
  candidateId: string,
): Promise<CandidateJobApplicationContext> {
  return jobsService.getCandidateApplicationContext(candidateId)
}

export async function applyToJob(input: {
  jobId: string
  candidateId: string
  message?: string | null
  cvFile?: File | null
  useExistingCv?: boolean
}): Promise<JobApplication> {
  return jobsService.applyToJob(input)
}
