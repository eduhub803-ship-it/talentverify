import { assertHrOrgApproved } from '@/features/hr/actions'
import { jobsService } from '@/services/jobsService'
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
  },
): Promise<Job> {
  await assertHrOrgApproved(hrUserId)
  return jobsService.createJob({
    ...input,
    createdBy: hrUserId,
  })
}
