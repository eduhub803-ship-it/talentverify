import { assertHrOrgApproved } from '@/features/hr/actions'
import { jobsService } from '@/services/jobsService'
import { employerService } from '@/features/employer/api/employer.service'
import { limitsFor } from '@/features/employer/plans'
import type { Job } from '@/types/domain'

export async function fetchHrJobs(hrUserId: string): Promise<Job[]> {
  await assertHrOrgApproved(hrUserId)
  return jobsService.listHrJobs(hrUserId)
}

export async function fetchOpenJobs(): Promise<Job[]> {
  return jobsService.listOpenJobs()
}

export async function fetchJob(jobId: string): Promise<Job | null> {
  return jobsService.getJob(jobId)
}

export async function fetchHrJob(
  hrUserId: string,
  jobId: string,
): Promise<Job> {
  await assertHrOrgApproved(hrUserId)
  const job = await jobsService.getJob(jobId)
  if (!job || job.createdBy !== hrUserId) {
    throw new Error('Job not found.')
  }
  return job
}

export async function createHrJob(
  hrUserId: string,
  input: {
    title: string
    description: string
    requirements: string[]
    experienceLevel?: string | null
    location: string
    jobType: string
    status?: Job['status']
    isExclusive?: boolean
    tracks?: Job['tracks']
  },
): Promise<Job> {
  const membership = await assertHrOrgApproved(hrUserId)

  // Service 33: the Free plan caps live job posts. Checked here as well as in
  // the backend so the employer gets the message before the form is submitted.
  const limit = limitsFor(membership.organization).activeJobPosts
  if (limit !== null) {
    const active = await employerService.countActiveJobs(membership.organizationId)
    if (active >= limit) {
      throw new Error(
        `Your Free plan allows ${limit} active job posts. Close a job or upgrade to Pro to post more.`,
      )
    }
  }

  return jobsService.createJob({
    ...input,
    createdBy: hrUserId,
    organizationId: membership.organizationId,
  })
}

export async function updateHrJobStatus(
  hrUserId: string,
  jobId: string,
  status: Job['status'],
): Promise<Job> {
  await assertHrOrgApproved(hrUserId)
  const job = await jobsService.getJob(jobId)
  if (!job || job.createdBy !== hrUserId) {
    throw new Error('Job not found.')
  }
  return jobsService.updateJobStatus(jobId, status)
}
