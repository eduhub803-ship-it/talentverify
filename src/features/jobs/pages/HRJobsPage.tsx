import { useContext } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ArrowRight, Briefcase, MapPin, Plus } from 'lucide-react'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { EmptyState } from '@/features/shared/components/layout/EmptyState'
import { Badge } from '@/features/shared/components/ui/Badge'
import { Button } from '@/features/shared/components/ui/Button'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Skeleton } from '@/features/shared/components/ui/Skeleton'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageContext } from '@/context/LanguageContext'
import { fetchHrJobs } from '../actions'

function preview(text: string): string {
  return text.length > 150 ? `${text.slice(0, 150)}...` : text
}

function statusVariant(status: string) {
  if (status === 'open') return 'success'
  if (status === 'draft') return 'warning'
  return 'danger'
}

export function HRJobsPage() {
  const userId = useAuthStore((s) => s.profile!.id)
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

  const {
    data: jobs = [],
    isLoading,
    error,
  } = useQuery({
    queryKey: ['jobs', 'hr', userId],
    queryFn: () => fetchHrJobs(userId),
  })

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-56" />
        <Skeleton className="h-40 w-full" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={t('hrJobs.title')}
        description={t('hrJobs.description')}
        actions={
          <Link to="/hr/jobs/create">
            <Button>
              <Plus className="h-4 w-4" />
              {t('hrJobs.createJob')}
            </Button>
          </Link>
        }
      />

      {error ? (
        <EmptyState
          icon={Briefcase}
          title={t('hrJobs.unavailableTitle')}
          description={
            error instanceof Error
              ? error.message
              : t('hrJobs.unavailableDescription')
          }
        />
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          title={t('hrJobs.emptyTitle')}
          description={t('hrJobs.emptyDescription')}
          action={
            <Link to="/hr/jobs/create">
              <Button>{t('hrJobs.createJob')}</Button>
            </Link>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {jobs.map((job) => (
            <Link key={job.id} to={`/hr/jobs/${job.id}`}>
              <Card className="h-full transition-shadow hover:shadow-md">
                <CardBody>
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <h2 className="font-semibold text-foreground">{job.title}</h2>
                      <p className="mt-2 text-sm text-muted">{preview(job.description)}</p>
                    </div>
                    <Badge variant={statusVariant(job.status)}>{job.status}</Badge>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs text-muted">
                    <span className="inline-flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      {job.location}
                    </span>
                    <Badge>{job.jobType}</Badge>
                  </div>
                  <div className="mt-4 flex items-center text-sm font-medium text-primary">
                    {t('hrJobs.viewDetails')}
                    <ArrowRight className="ml-1 h-4 w-4" />
                  </div>
                </CardBody>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
