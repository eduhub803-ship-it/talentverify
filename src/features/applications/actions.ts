import { assertHrOrgApproved } from '@/features/hr/actions'
import { jobsService } from '@/services/jobsService'
import type {
  ApplicationStatus,
  CandidateJobApplicationContext,
  JobApplication,
} from '@/types/domain'

async function assertHrOwnsJob(hrUserId: string, jobId: string): Promise<void> {
  const job = await jobsService.getJob(jobId)
  if (!job || job.createdBy !== hrUserId) {
    throw new Error('Job not found.')
  }
}

async function assertHrOwnsApplication(
  hrUserId: string,
  applicationId: string,
): Promise<void> {
  const jobs = await jobsService.listHrJobs(hrUserId)

  for (const job of jobs) {
    const applications = await jobsService.getApplicationsForJob(job.id)
    if (applications.some((application) => application.id === applicationId)) {
      return
    }
  }

  throw new Error('Application not found.')
}

export async function fetchJobApplications(
  hrUserId: string,
  jobId: string,
): Promise<JobApplication[]> {
  await assertHrOrgApproved(hrUserId)
  await assertHrOwnsJob(hrUserId, jobId)
  return jobsService.getApplicationsForJob(jobId)
}

export async function updateJobApplicationStatus(
  hrUserId: string,
  applicationId: string,
  status: ApplicationStatus,
): Promise<JobApplication> {
  await assertHrOrgApproved(hrUserId)
  await assertHrOwnsApplication(hrUserId, applicationId)
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
