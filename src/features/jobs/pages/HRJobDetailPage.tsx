import { useContext } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  ArrowLeft,
  Briefcase,
  Check,
  Download,
  MapPin,
  Send,
  User,
  X,
} from 'lucide-react'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { EmptyState } from '@/features/shared/components/layout/EmptyState'
import { Badge } from '@/features/shared/components/ui/Badge'
import { Button } from '@/features/shared/components/ui/Button'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Skeleton } from '@/features/shared/components/ui/Skeleton'
import { formatDate } from '@/lib/utils'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageContext } from '@/context/LanguageContext'
import type { ApplicationStatus, Job } from '@/types/domain'
import { fetchJobApplications, updateJobApplicationStatus } from '@/features/applications/actions'
import { invalidateAdminWorkspace } from '@/features/admin/queryKeys'
import { notificationsQueryKeys } from '@/features/notifications/queryKeys'
import { JobMatchPanel } from '@/features/employer/components/JobMatchPanel'
import { fetchHrJob, updateHrJobStatus } from '../actions'

function applicationVariant(status: ApplicationStatus) {
  if (status === 'accepted') return 'success'
  if (status === 'rejected') return 'danger'
  return 'warning'
}

function jobVariant(status: string) {
  if (status === 'open') return 'success'
  if (status === 'draft') return 'warning'
  return 'danger'
}

export function HRJobDetailPage() {
  const { id } = useParams<{ id: string }>()
  const userId = useAuthStore((s) => s.profile!.id)
  const qc = useQueryClient()
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

  const {
    data: job,
    isLoading: jobLoading,
    error: jobError,
  } = useQuery({
    queryKey: ['jobs', 'hr', userId, id],
    queryFn: () => fetchHrJob(userId, id!),
    enabled: Boolean(id),
  })

  const {
    data: applications = [],
    isLoading: applicationsLoading,
    error: applicationsError,
  } = useQuery({
    queryKey: ['applications', 'job', id],
    queryFn: () => fetchJobApplications(userId, id!),
    enabled: Boolean(id && job),
  })

  const updateStatus = useMutation({
    mutationFn: ({
      applicationId,
      status,
    }: {
      applicationId: string
      status: ApplicationStatus
    }) => updateJobApplicationStatus(userId, applicationId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['applications', 'job', id] })
      void invalidateAdminWorkspace(qc)
      qc.invalidateQueries({ queryKey: notificationsQueryKeys.root })
    },
  })

  const updateJob = useMutation({
    mutationFn: (status: Job['status']) => updateHrJobStatus(userId, job!.id, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs', 'hr', userId] })
      qc.invalidateQueries({ queryKey: ['jobs', 'hr', userId, id] })
      qc.invalidateQueries({ queryKey: ['jobs', 'open'] })
    },
  })

  const changeJobStatus = (status: Job['status']) => {
    if (updateJob.isPending) return
    if (status === 'closed' && !window.confirm(t('hrJobDetail.closeConfirm'))) return
    updateJob.mutate(status)
  }

  if (jobLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-72 w-full" />
      </div>
    )
  }

  if (jobError || !job) {
    return (
      <div>
        <Link
          to="/hr/jobs"
          className="mb-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" />
          {t('hrJobDetail.backToJobs')}
        </Link>
        <EmptyState
          icon={Briefcase}
          title={t('hrJobDetail.unavailableTitle')}
          description={
            jobError instanceof Error
              ? jobError.message
              : t('hrJobDetail.unavailableDescription')
          }
        />
      </div>
    )
  }

  return (
    <div>
      <Link
        to="/hr/jobs"
        className="mb-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('hrJobDetail.backToJobs')}
      </Link>

      <PageHeader
        title={job.title}
        description={`${job.jobType} ${t('hrJobDetail.in')} ${job.location}`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={jobVariant(job.status)}>{job.status}</Badge>
            {job.status === 'draft' && (
              <Button
                size="sm"
                isLoading={updateJob.isPending}
                onClick={() => changeJobStatus('open')}
              >
                <Send className="h-4 w-4" />
                {t('hrJobDetail.publish')}
              </Button>
            )}
            {job.status === 'open' && (
              <Button
                size="sm"
                variant="secondary"
                disabled={updateJob.isPending}
                onClick={() => changeJobStatus('closed')}
              >
                {t('hrJobDetail.closeJob')}
              </Button>
            )}
            {job.status === 'closed' && (
              <Button
                size="sm"
                variant="secondary"
                isLoading={updateJob.isPending}
                onClick={() => changeJobStatus('open')}
              >
                {t('hrJobDetail.reopen')}
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="space-y-6">
          <Card>
            <CardBody className="space-y-5">
              <div>
                <p className="text-sm font-medium text-muted">
                  {t('hrJobDetail.description')}
                </p>
                <p className="mt-2 whitespace-pre-line text-sm text-foreground">
                  {job.description}
                </p>
              </div>
              {job.requirements.length > 0 && (
                <div>
                  <p className="text-sm font-medium text-muted">
                    {t('hrJobDetail.requirements')}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {job.requirements.map((requirement) => (
                      <Badge key={requirement}>{requirement}</Badge>
                    ))}
                  </div>
                </div>
              )}
              <dl className="grid gap-4 text-sm sm:grid-cols-3">
                <div>
                  <dt className="text-muted">{t('hrJobDetail.location')}</dt>
                  <dd className="mt-1 flex items-center gap-1 font-medium">
                    <MapPin className="h-4 w-4 text-muted" />
                    {job.location}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted">{t('hrJobDetail.jobType')}</dt>
                  <dd className="mt-1 font-medium">{job.jobType}</dd>
                </div>
                <div>
                  <dt className="text-muted">{t('hrJobDetail.experience')}</dt>
                  <dd className="mt-1 font-medium">
                    {job.experienceLevel ?? t('hrJobDetail.notSpecified')}
                  </dd>
                </div>
              </dl>
            </CardBody>
          </Card>

          <JobMatchPanel jobId={job.id} />
        </div>

        <div>
          <h2 className="mb-4 text-lg font-semibold">{t('hrJobDetail.applicants')}</h2>
          {applicationsLoading ? (
            <div className="space-y-3">
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-32 w-full" />
            </div>
          ) : applicationsError ? (
            <EmptyState
              icon={User}
              title={t('hrJobDetail.applicantsUnavailableTitle')}
              description={
                applicationsError instanceof Error
                  ? applicationsError.message
                  : t('hrJobDetail.applicantsUnavailableDescription')
              }
            />
          ) : applications.length === 0 ? (
            <EmptyState
              icon={User}
              title={t('hrJobDetail.noApplicantsTitle')}
              description={t('hrJobDetail.noApplicantsDescription')}
            />
          ) : (
            <div className="space-y-4">
              {applications.map((application) => (
                <Card key={application.id}>
                  <CardBody>
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-semibold text-foreground">
                          {application.candidate?.name ?? t('hrJobDetail.candidateFallback')}
                        </p>
                        {application.candidate?.email && (
                          <p className="text-sm text-muted">
                            {application.candidate.email}
                          </p>
                        )}
                        <p className="mt-1 text-xs text-muted">
                          {t('hrJobDetail.applied')} {formatDate(application.createdAt)}
                        </p>
                      </div>
                      <Badge variant={applicationVariant(application.status)}>
                        {application.status}
                      </Badge>
                    </div>
                    {application.message && (
                      <p className="mt-3 text-sm text-foreground">
                        {application.message}
                      </p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Link to={`/hr/candidate/${application.candidateId}`}>
                        <Button variant="secondary" size="sm">
                          <User className="h-4 w-4" />
                          {t('hrJobDetail.profile')}
                        </Button>
                      </Link>
                      {application.cvUrl && (
                        <a
                          href={application.cvUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Button variant="secondary" size="sm">
                            <Download className="h-4 w-4" />
                            CV
                          </Button>
                        </a>
                      )}
                    </div>
                    {application.status === 'pending' && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          isLoading={updateStatus.isPending}
                          onClick={() =>
                            updateStatus.mutate({
                              applicationId: application.id,
                              status: 'accepted',
                            })
                          }
                        >
                          <Check className="h-4 w-4" />
                          {t('hrJobDetail.accept')}
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          disabled={updateStatus.isPending}
                          onClick={() =>
                            updateStatus.mutate({
                              applicationId: application.id,
                              status: 'rejected',
                            })
                          }
                        >
                          <X className="h-4 w-4" />
                          {t('hrJobDetail.reject')}
                        </Button>
                      </div>
                    )}
                  </CardBody>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
