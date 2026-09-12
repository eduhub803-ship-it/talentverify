/**
 * Service 34: Smart Candidate Matching & Shortlisting.
 *
 * Deterministic and explainable - set intersection over stored data, no AI and
 * no opaque score. Every point is attributable to a stated reason, and the
 * candidate pool is always the privacy-safe one (verified AND employer-visible).
 */
import type {
  CandidateJobMatch,
  CandidateProfile,
  Job,
  OpportunityTrack,
} from '@/types/domain'

const WEIGHTS = {
  requirement: 55,
  location: 15,
  preferredField: 15,
  employmentType: 10,
  availability: 5,
} as const

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

function candidateSkillSet(candidate: CandidateProfile): Set<string> {
  return new Set([
    ...candidate.skills.map(normalize),
    ...candidate.structuredSkills.map((skill) => normalize(skill.name)),
  ])
}

/** A requirement counts as met when it appears in skills, headline or bio. */
function requirementMet(requirement: string, candidate: CandidateProfile): boolean {
  const needle = normalize(requirement)
  if (!needle) return false
  if (candidateSkillSet(candidate).has(needle)) return true

  const haystack = [
    candidate.headline ?? '',
    candidate.bio ?? '',
    ...candidate.skills,
    ...candidate.structuredSkills.map((skill) => skill.name),
    ...candidate.experience.map((item) => `${item.title} ${item.description ?? ''}`),
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(needle)
}

export interface MatchInput {
  job: Job
  candidates: CandidateProfile[]
  shortlistedIds: string[]
  /** Applied after ranking, so a free plan sees the strongest matches first. */
  limit?: number | null
}

export function matchCandidatesToJob({
  job,
  candidates,
  shortlistedIds,
  limit = null,
}: MatchInput): CandidateJobMatch[] {
  const shortlisted = new Set(shortlistedIds)
  const requirements = (job.requirements ?? []).filter((item) => item.trim())
  const jobLocation = normalize(job.location ?? '')
  const jobType = normalize(job.jobType ?? '')

  const matches = candidates.map((candidate) => {
    const matchedRequirements: string[] = []
    const missingRequirements: string[] = []
    const reasons: string[] = []

    for (const requirement of requirements) {
      if (requirementMet(requirement, candidate)) matchedRequirements.push(requirement)
      else missingRequirements.push(requirement)
    }

    let score = 0

    if (requirements.length > 0) {
      const ratio = matchedRequirements.length / requirements.length
      score += Math.round(WEIGHTS.requirement * ratio)
      reasons.push(
        `${matchedRequirements.length} of ${requirements.length} listed requirements matched`,
      )
    } else {
      // Nothing to match against: award the requirement weight neutrally so
      // jobs without requirements still rank candidates on the other signals.
      score += WEIGHTS.requirement
      reasons.push('No specific requirements listed on this job')
    }

    const candidateLocation = normalize(candidate.location ?? '')
    const preferredLocations = candidate.careerPreferences.preferredLocations.map(normalize)
    if (
      jobLocation &&
      (candidateLocation.includes(jobLocation) ||
        jobLocation.includes(candidateLocation) ||
        preferredLocations.some(
          (item) => item.includes(jobLocation) || jobLocation.includes(item),
        ))
    ) {
      score += WEIGHTS.location
      reasons.push(`Location matches ${job.location}`)
    }

    const preferredFields = candidate.careerPreferences.preferredFields.map(normalize)
    const jobTitle = normalize(job.title ?? '')
    if (preferredFields.some((field) => field && (jobTitle.includes(field) || field.includes(jobTitle)))) {
      score += WEIGHTS.preferredField
      reasons.push('Role matches a preferred field')
    }

    const employmentTypes = candidate.careerPreferences.employmentTypes.map(normalize)
    if (jobType && employmentTypes.includes(jobType)) {
      score += WEIGHTS.employmentType
      reasons.push(`Open to ${job.jobType} work`)
    }

    if (candidate.careerPreferences.openToWork) {
      score += WEIGHTS.availability
      reasons.push('Currently open to work')
    }

    return {
      candidateId: candidate.userId,
      candidateName: candidate.profile?.fullName ?? 'Verified candidate',
      headline: candidate.headline,
      location: candidate.location,
      sehTalentId: candidate.sehTalentId ?? null,
      skills: candidate.skills,
      score: Math.min(100, score),
      matchedRequirements,
      missingRequirements,
      reasons,
      shortlisted: shortlisted.has(candidate.userId),
    }
  })

  matches.sort((a, b) => b.score - a.score || a.candidateName.localeCompare(b.candidateName))
  return limit === null ? matches : matches.slice(0, limit)
}

/* ----------------------------- opportunity hubs ---------------------------- */

export const OPPORTUNITY_TRACKS: OpportunityTrack[] = ['internship', 'graduate', 'ngo']

export type JobHub = 'all' | 'exclusive' | 'early_career' | 'ngo'

/**
 * Service 27 restricts exclusive roles to verified candidates. This is the only
 * place that rule is expressed for browsing, so it cannot drift between hubs.
 */
export function canSeeExclusive(verificationStatus: string | undefined): boolean {
  return verificationStatus === 'verified'
}

export function jobsInHub(jobs: Job[], hub: JobHub): Job[] {
  switch (hub) {
    case 'exclusive':
      return jobs.filter((job) => job.isExclusive)
    case 'early_career':
      return jobs.filter((job) =>
        (job.tracks ?? []).some((track) => track === 'internship' || track === 'graduate'),
      )
    case 'ngo':
      return jobs.filter((job) => (job.tracks ?? []).includes('ngo'))
    default:
      return jobs
  }
}

/** Removes exclusive roles the candidate is not yet eligible to see. */
export function visibleJobsForCandidate(
  jobs: Job[],
  verificationStatus: string | undefined,
): Job[] {
  if (canSeeExclusive(verificationStatus)) return jobs
  return jobs.filter((job) => !job.isExclusive)
}
