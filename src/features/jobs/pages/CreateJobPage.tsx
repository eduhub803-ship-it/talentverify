import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Send } from 'lucide-react'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Button } from '@/features/shared/components/ui/Button'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Input } from '@/features/shared/components/ui/Input'
import { useContext, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/features/shared/components/ui/Badge'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageContext } from '@/context/LanguageContext'
import { localizeMessage } from '@/i18n/errors'
import { fetchEmployerPlanUsage } from '@/features/employer/actions'
import { employerQueryKeys } from '@/features/employer/queryKeys'
import { OPPORTUNITY_TRACKS } from '@/features/employer/matching'
import type { OpportunityTrack } from '@/types/domain'
import { createHrJob } from '../actions'
import { jobSchema, type JobForm } from '../schemas/job.schema'
import { notificationsQueryKeys } from '@/features/notifications/queryKeys'
import type { Job } from '@/types/domain'

function parseRequirements(value?: string): string[] {
  return (value ?? '')
    .split('\n')
    .flatMap((line) => line.split(','))
    .map((item) => item.trim())
    .filter(Boolean)
}

export function CreateJobPage() {
  const profile = useAuthStore((s) => s.profile)
  const userId = profile!.id
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)
  const [isExclusive, setIsExclusive] = useState(false)
  const [tracks, setTracks] = useState<OpportunityTrack[]>([])

  const { data: planUsage } = useQuery({
    queryKey: employerQueryKeys.planUsage(userId),
    queryFn: () => fetchEmployerPlanUsage(profile),
  })
  const navigate = useNavigate()
  const qc = useQueryClient()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<JobForm>({
    resolver: zodResolver(jobSchema),
    defaultValues: {
      jobType: 'Full-time',
      experienceLevel: '',
    },
  })

  const mutation = useMutation({
    mutationFn: ({ data, status }: { data: JobForm; status: Job['status'] }) =>
      createHrJob(userId, {
        title: data.title,
        description: data.description,
        requirements: parseRequirements(data.requirements),
        experienceLevel: data.experienceLevel || null,
        location: data.location,
        jobType: data.jobType,
        status,
        isExclusive,
        tracks,
      }),
    onSuccess: (job) => {
      qc.invalidateQueries({ queryKey: ['jobs', 'hr', userId] })
      qc.invalidateQueries({ queryKey: ['jobs', 'open'] })
      qc.invalidateQueries({ queryKey: notificationsQueryKeys.root })
      navigate(`/hr/jobs/${job.id}`)
    },
  })

  const saveJob = (data: JobForm, status: Job['status']) => {
    if (mutation.isPending) return
    mutation.mutate({ data, status })
  }

  return (
    <div>
      <Link
        to="/hr/jobs"
        className="mb-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
      >
        <ArrowLeft className="h-4 w-4" />
        {t('createJob.backToJobs')}
      </Link>

      <PageHeader
        title={t('createJob.title')}
        description={t('createJob.description')}
      />

      <form onSubmit={handleSubmit((data) => saveJob(data, 'open'))}>
        <Card>
          <CardBody className="space-y-5">
            <Input
              label={t('createJob.field.title')}
              placeholder={t('createJob.placeholder.title')}
              error={localizeMessage(errors.title?.message, t)}
              {...register('title')}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                {t('createJob.field.description')}
              </label>
              <textarea
                className="min-h-[140px] w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                placeholder={t('createJob.placeholder.description')}
                {...register('description')}
              />
              {errors.description && (
                <p className="text-xs text-red-600">
                  {localizeMessage(errors.description.message, t)}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                {t('createJob.field.requirements')}
              </label>
              <textarea
                className="min-h-[110px] w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                placeholder={t('createJob.placeholder.requirements')}
                {...register('requirements')}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label={t('createJob.field.experienceLevel')}
                placeholder={t('createJob.placeholder.experienceLevel')}
                error={localizeMessage(errors.experienceLevel?.message, t)}
                {...register('experienceLevel')}
              />
              <Input
                label={t('createJob.field.location')}
                placeholder={t('createJob.placeholder.location')}
                error={localizeMessage(errors.location?.message, t)}
                {...register('location')}
              />
              <Input
                label={t('createJob.field.jobType')}
                placeholder={t('createJob.placeholder.jobType')}
                error={localizeMessage(errors.jobType?.message, t)}
                {...register('jobType')}
              />
            </div>
            <div className="space-y-3 rounded-xl border border-border bg-slate-50/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">
                  {t('createJob.opportunityHubs')}
                </p>
                {planUsage && (
                  <Badge variant={planUsage.jobPosts.reached ? 'danger' : 'default'}>
                    {planUsage.plan === 'pro'
                      ? t('createJob.proUnlimited')
                      : t('createJob.freePosts')
                          .replace('{used}', String(planUsage.jobPosts.used))
                          .replace('{limit}', String(planUsage.jobPosts.limit))}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted">
                {t('createJob.hubsDescription')}
              </p>
              <div className="flex flex-wrap gap-2">
                {OPPORTUNITY_TRACKS.map((track) => (
                  <Button
                    key={track}
                    type="button"
                    size="sm"
                    variant={tracks.includes(track) ? 'primary' : 'secondary'}
                    aria-pressed={tracks.includes(track)}
                    onClick={() =>
                      setTracks((current) =>
                        current.includes(track)
                          ? current.filter((item) => item !== track)
                          : [...current, track],
                      )
                    }
                  >
                    {t(`createJob.track.${track}`)}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant={isExclusive ? 'primary' : 'secondary'}
                  aria-pressed={isExclusive}
                  onClick={() => setIsExclusive((value) => !value)}
                >
                  {t('createJob.sehExclusive')}
                </Button>
              </div>
            </div>

            {planUsage?.jobPosts.reached && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                {t('createJob.limitReached').replace(
                  '{limit}',
                  String(planUsage.jobPosts.limit),
                )}
              </p>
            )}

            {mutation.isError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : t('createJob.failed')}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                isLoading={mutation.isPending}
                disabled={planUsage?.jobPosts.reached}
              >
                <Send className="h-4 w-4" />
                {t('createJob.publish')}
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={mutation.isPending}
                onClick={handleSubmit((data) => saveJob(data, 'draft'))}
              >
                {t('createJob.saveDraft')}
              </Button>
              <Link to="/hr/jobs">
                <Button type="button" variant="ghost" disabled={mutation.isPending}>
                  {t('common.cancel')}
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </form>
    </div>
  )
}
