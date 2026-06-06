import { useContext, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Briefcase, MapPin } from 'lucide-react'
import { ApplyJobModal } from '@/features/applications/components/ApplyJobModal'
import { fetchCandidateJobApplicationContext } from '@/features/applications/actions'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { EmptyState } from '@/features/shared/components/layout/EmptyState'
import { Badge } from '@/features/shared/components/ui/Badge'
import { Button } from '@/features/shared/components/ui/Button'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Skeleton } from '@/features/shared/components/ui/Skeleton'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageContext } from '@/context/LanguageContext'
import { notificationsQueryKeys } from '@/features/notifications/queryKeys'
import type { CandidateJobApplicationContext, Job } from '@/types/domain'
import { fetchOpenJobs } from '../actions'

const emptyContext: CandidateJobApplicationContext = {
  existingCvUrl: null,
  existingCvName: null,
  appliedJobIds: [],
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

  const { data: jobs = [], isLoading: jobsLoading } = useQuery({
    queryKey: ['jobs', 'open'],
    queryFn: fetchOpenJobs,
  })

  const { data: context = emptyContext, isLoading: contextLoading } = useQuery({
    queryKey: ['applications', 'candidate-context', candidateId],
    queryFn: () => fetchCandidateJobApplicationContext(candidateId),
  })

  const isLoading = jobsLoading || contextLoading
  const appliedJobIds = new Set(context.appliedJobIds)

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

      {jobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={t('candidateJobs.emptyTitle')}
          description={t('candidateJobs.emptyDescription')}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {jobs.map((job) => {
            const hasApplied = appliedJobIds.has(job.id)

            return (
              <Card key={job.id} className="h-full">
                <CardBody className="flex h-full flex-col">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-foreground">{job.title}</h2>
                      <p className="mt-2 text-sm text-muted">{preview(job.description)}</p>
                    </div>
                    <Badge variant="success">{job.status}</Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {job.location}
                    </span>
                    <Badge>{job.jobType}</Badge>
                    {job.experienceLevel && <Badge>{job.experienceLevel}</Badge>}
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
                    <Button
                      type="button"
                      disabled={hasApplied}
                      onClick={() => setSelectedJob(job)}
                    >
                      {hasApplied ? t('candidateJobs.applied') : t('candidateJobs.apply')}
                    </Button>
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
