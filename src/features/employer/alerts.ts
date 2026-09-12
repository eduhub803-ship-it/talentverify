/**
 * Service 30: Smart Job Alerts.
 *
 * Deterministic matching between a candidate's saved criteria and a job. No AI:
 * a job matches when every criterion the candidate actually set is satisfied.
 */
import type { Job, JobAlert, JobAlertFrequency } from '@/types/domain'

/**
 * Only `immediate` is offered: every alert fires the moment a matching job is
 * published. Digest scheduling would need a scheduled job that does not exist,
 * so daily/weekly are not presented as though they work. The domain type keeps
 * both values for data compatibility with anything already stored.
 */
export const JOB_ALERT_FREQUENCIES: JobAlertFrequency[] = ['immediate']

export const SUPPORTED_ALERT_FREQUENCIES: JobAlertFrequency[] = ['immediate']

export function isSupportedFrequency(frequency: JobAlertFrequency): boolean {
  return SUPPORTED_ALERT_FREQUENCIES.includes(frequency)
}

function normalize(value: string): string {
  return value.trim().toLowerCase()
}

export interface AlertMatch {
  matched: boolean
  reasons: string[]
}

export function evaluateAlert(alert: JobAlert, job: Job): AlertMatch {
  if (!alert.active) return { matched: false, reasons: [] }

  const reasons: string[] = []
  const haystack = [job.title, job.description, ...(job.requirements ?? [])]
    .join(' ')
    .toLowerCase()

  if (alert.exclusiveOnly && !job.isExclusive) {
    return { matched: false, reasons: [] }
  }
  if (alert.exclusiveOnly) reasons.push('SEH exclusive role')

  if (alert.keywords.length > 0) {
    const hit = alert.keywords.find((keyword) => haystack.includes(normalize(keyword)))
    if (!hit) return { matched: false, reasons: [] }
    reasons.push(`Matches "${hit}"`)
  }

  if (alert.location) {
    const wanted = normalize(alert.location)
    const jobLocation = normalize(job.location ?? '')
    if (!jobLocation.includes(wanted) && !wanted.includes(jobLocation)) {
      return { matched: false, reasons: [] }
    }
    reasons.push(`In ${job.location}`)
  }

  if (alert.jobTypes.length > 0) {
    const jobType = normalize(job.jobType ?? '')
    if (!alert.jobTypes.map(normalize).includes(jobType)) {
      return { matched: false, reasons: [] }
    }
    reasons.push(job.jobType)
  }

  if (alert.tracks.length > 0) {
    const tracks = job.tracks ?? []
    const hit = alert.tracks.find((track) => tracks.includes(track))
    if (!hit) return { matched: false, reasons: [] }
    reasons.push(`${hit} opportunity`)
  }

  if (reasons.length === 0) reasons.push('Matches your saved alert')
  return { matched: true, reasons }
}

/**
 * Alerts that should fire for a newly published job. Exclusive roles only ever
 * notify candidates who are eligible to see them.
 */
export function alertsMatchingJob(
  alerts: JobAlert[],
  job: Job,
  isEligible: (candidateId: string) => boolean,
): { alert: JobAlert; reasons: string[] }[] {
  return alerts
    .filter((alert) => !job.isExclusive || isEligible(alert.candidateId))
    .map((alert) => ({ alert, match: evaluateAlert(alert, job) }))
    .filter((entry) => entry.match.matched)
    .map((entry) => ({ alert: entry.alert, reasons: entry.match.reasons }))
}

export interface AlertDraft {
  name: string
  keywords: string
  location: string
  jobTypes: string
  tracks: JobAlert['tracks']
  exclusiveOnly: boolean
  frequency: JobAlertFrequency
}

export function splitCriteria(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
}

export interface AlertValidation {
  valid: boolean
  error: string | null
}

/** An alert with no criteria at all would notify on every job - reject it. */
export function validateAlertDraft(draft: AlertDraft): AlertValidation {
  if (!draft.name.trim()) {
    return { valid: false, error: 'Give the alert a name so you can recognise it.' }
  }
  const hasCriteria =
    splitCriteria(draft.keywords).length > 0 ||
    draft.location.trim().length > 0 ||
    splitCriteria(draft.jobTypes).length > 0 ||
    draft.tracks.length > 0 ||
    draft.exclusiveOnly
  if (!hasCriteria) {
    return {
      valid: false,
      error: 'Add at least one criterion, otherwise the alert matches every job.',
    }
  }
  if (!isSupportedFrequency(draft.frequency)) {
    return {
      valid: false,
      error: 'Only immediate alerts are available at the moment.',
    }
  }
  return { valid: true, error: null }
}
