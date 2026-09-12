import { useContext, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Briefcase, Lock, MapPin, ShieldCheck, Sparkles } from 'lucide-react'
import { ApplyJobModal } from '@/features/applications/components/ApplyJobModal'
import { fetchCandidateJobApplicationContext } from '@/features/applications/actions'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { EmptyState } from '@/features/shared/components/layout/EmptyState'
import { Badge } from '@/features/shared/components/ui/Badge'
import { Button } from '@/features/shared/components/ui/Button'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Skeleton } from '@/features/shared/components/ui/Skeleton'
import { formatDate } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageContext } from '@/context/LanguageContext'
import { notificationsQueryKeys } from '@/features/notifications/queryKeys'
import type { ApplicationStatus, CandidateJobApplicationContext, Job } from '@/types/domain'
import { fetchJobsForCandidate } from '@/features/employer/actions'
import { jobsInHub, type JobHub } from '@/features/employer/matching'
import { JobAlertsPanel } from '@/features/employer/components/JobAlertsPanel'
import { fetchMyCandidateProfile } from '@/features/candidate/actions'
import { cn } from '@/lib/utils'

const emptyContext: CandidateJobApplicationContext = {
  existingCvUrl: null,
  existingCvName: null,
  appliedJobIds: [],
  applications: [],
}

const applicationVariant: Record<ApplicationStatus, 'warning' | 'success' | 'danger'> = {
  pending: 'warning',
  accepted: 'success',
  rejected: 'danger',
}

function preview(text: string): string {
  return text.length > 180 ? `${text.slice(0, 180)}...` : text
}

export function CandidateJobsPage() {
  const candidateId = useAuthStore((s) => s.profile!.id)
  const qc = useQueryClient()
  const [selectedJob, setSelectedJob] = useState<Job | null>(null)
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

  const [hub, setHub] = useState<JobHub>('all')

  // Exclusive roles (service 27) are filtered server-side by verification.
  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs', 'open', 'candidate', candidateId],
    queryFn: () => fetchJobsForCandidate(candidateId),
  })

  const { data: profile } = useQuery({
    queryKey: ['candidate', 'profile', candidateId],
    queryFn: () => fetchMyCandidateProfile(candidateId),
  })

  const { data: context = emptyContext, isLoading: contextLoading } = useQuery({
    queryKey: ['applications', 'candidate-context', candidateId],
    queryFn: () => fetchCandidateJobApplicationContext(candidateId),
  })

  const isLoading = jobsLoading || contextLoading
  const isVerified = profile?.verificationStatus === 'verified'
  const visibleJobs = jobsInHub(jobs, hub)
  const hubs: { key: JobHub; labelKey: string; count: number }[] = [
    { key: 'all', labelKey: 'candidateJobs.hub.all', count: jobs.length },
    {
      key: 'exclusive',
      labelKey: 'candidateJobs.hub.exclusive',
      count: jobsInHub(jobs, 'exclusive').length,
    },
    {
      key: 'early_career',
      labelKey: 'candidateJobs.hub.earlyCareer',
      count: jobsInHub(jobs, 'early_career').length,
    },
    { key: 'ngo', labelKey: 'candidateJobs.hub.ngo', count: jobsInHub(jobs, 'ngo').length },
  ]
  const appliedJobIds = new Set(context.appliedJobIds)
  const applicationByJobId = new Map(
    context.applications.map((application) => [application.jobId, application]),
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-44 w-full" />
        <Skeleton className="h-44 w-full" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={t('candidateJobs.title')}
        description={t('candidateJobs.description')}
      />

      <JobAlertsPanel candidateId={candidateId} />

      <div className="mb-4 flex flex-wrap gap-2">
        {hubs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setHub(item.key)}
            className={cn(
              'rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors',
              hub === item.key
                ? 'border-primary bg-primary-50 text-primary'
                : 'border-border bg-white text-muted hover:bg-slate-50',
            )}
          >
            {t(item.labelKey)} ({item.count})
          </button>
        ))}
      </div>

      {hub === 'exclusive' && !isVerified && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <Lock className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{t('candidateJobs.exclusiveLocked')}</span>
        </div>
      )}

      {visibleJobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={t('candidateJobs.emptyTitle')}
          description={t('candidateJobs.emptyDescription')}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {visibleJobs.map((job) => {
            const hasApplied = appliedJobIds.has(job.id)
            const application = applicationByJobId.get(job.id)

            return (
              <Card key={job.id} className="h-full">
                <CardBody className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-foreground">{job.title}</h2>
                      <p className="mt-2 text-sm text-muted">{preview(job.description)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <Badge variant="success">{job.status}</Badge>
                      {job.isExclusive && (
                        <Badge variant="primary">
                          <Sparkles className="me-1 h-3 w-3" />
                          {t('candidateJobs.exclusiveBadge')}
                        </Badge>
                      )}
                    </div>
                  </div>

                  {(job.organizationName || job.employerVerified) && (
                    <p className="mt-2 flex flex-wrap items-center gap-1 text-xs text-muted">
                      {job.organizationName}
                      {job.employerVerified && (
                        <span className="inline-flex items-center gap-1 text-success">
                          <ShieldCheck className="h-3.5 w-3.5" />
                          {t('candidateJobs.verifiedEmployer')}
                        </span>
                      )}
                    </p>
                  )}
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {job.location}
                    </span>
                    <Badge>{job.jobType}</Badge>
                    {job.experienceLevel && <Badge>{job.experienceLevel}</Badge>}
                    {(job.tracks ?? []).map((track) => (
                      <Badge key={track} variant="primary">
                        {t(`candidateJobs.track.${track}`)}
                      </Badge>
                    ))}
                  </div>
                  {job.requirements.length > 0 && (
                    <div className="mt-4 flex flex-wrap gap-2">
                      {job.requirements.slice(0, 4).map((requirement) => (
                        <Badge key={requirement} variant="primary">
                          {requirement}
                        </Badge>
                      ))}
                    </div>
                  )}
                  <div className="mt-auto pt-5">
                    {hasApplied ? (
                      <div className="rounded-lg border border-border bg-slate-50 px-3 py-2">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-sm text-muted">
                            {t('candidateJobs.applicationStatus')}
                          </span>
                          <Badge
                            variant={
                              application ? applicationVariant[application.status] : 'default'
                            }
                          >
                            {t(
                              `candidateJobs.status.${application?.status ?? 'pending'}`,
                            )}
                          </Badge>
                        </div>
                        {application && (
                          <p className="mt-1 text-xs text-muted">
                            {t('candidateJobs.appliedOn')}{' '}
                            {formatDate(application.createdAt)}
                          </p>
                        )}
                      </div>
                    ) : (
                      <Button type="button" onClick={() => setSelectedJob(job)}>
                        {t('candidateJobs.apply')}
                      </Button>
                    )}
                  </div>
                </CardBody>
              </Card>
            )
          })}
        </div>
      )}

      <ApplyJobModal
        key={selectedJob?.id ?? 'apply-job-modal'}
        job={selectedJob}
        candidateId={candidateId}
        context={context}
        onClose={() => setSelectedJob(null)}
        onApplied={() => {
          setSelectedJob(null)
          qc.invalidateQueries({
            queryKey: ['applications', 'candidate-context', candidateId],
          })
          qc.invalidateQueries({ queryKey: notificationsQueryKeys.root })
        }}
      />
    </div>
  )
}
