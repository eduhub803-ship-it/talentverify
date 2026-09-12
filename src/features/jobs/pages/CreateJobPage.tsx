import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, Send } from 'lucide-react'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Button } from '@/features/shared/components/ui/Button'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Input } from '@/features/shared/components/ui/Input'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Badge } from '@/features/shared/components/ui/Badge'
import { useAuthStore } from '@/stores/auth-store'
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
        Back to jobs
      </Link>

      <PageHeader
        title="Create Job"
        description="Add a role candidates can browse and apply to."
      />

      <form onSubmit={handleSubmit((data) => saveJob(data, 'open'))}>
        <Card>
          <CardBody className="space-y-5">
            <Input
              label="Title"
              placeholder="e.g. Senior Product Designer"
              error={errors.title?.message}
              {...register('title')}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Description
              </label>
              <textarea
                className="min-h-[140px] w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                placeholder="Describe the role, responsibilities, and team."
                {...register('description')}
              />
              {errors.description && (
                <p className="text-xs text-red-600">{errors.description.message}</p>
              )}
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-foreground">
                Requirements
              </label>
              <textarea
                className="min-h-[110px] w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                placeholder="Add one requirement per line, or separate with commas."
                {...register('requirements')}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <Input
                label="Experience level"
                placeholder="e.g. Senior"
                error={errors.experienceLevel?.message}
                {...register('experienceLevel')}
              />
              <Input
                label="Location"
                placeholder="e.g. Remote"
                error={errors.location?.message}
                {...register('location')}
              />
              <Input
                label="Job type"
                placeholder="e.g. Full-time"
                error={errors.jobType?.message}
                {...register('jobType')}
              />
            </div>
            <div className="space-y-3 rounded-xl border border-border bg-slate-50/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-medium text-foreground">Opportunity hubs</p>
                {planUsage && (
                  <Badge variant={planUsage.jobPosts.reached ? 'danger' : 'default'}>
                    {planUsage.plan === 'pro'
                      ? 'Pro · unlimited posts'
                      : `Free · ${planUsage.jobPosts.used}/${planUsage.jobPosts.limit} active posts`}
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted">
                Listing a role in a hub helps the right candidates find it. SEH exclusive
                roles are shown only to verified candidates.
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
                    {track === 'ngo'
                      ? 'NGO & INGO'
                      : track === 'internship'
                        ? 'Internship'
                        : 'Graduate'}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant={isExclusive ? 'primary' : 'secondary'}
                  aria-pressed={isExclusive}
                  onClick={() => setIsExclusive((value) => !value)}
                >
                  SEH exclusive
                </Button>
              </div>
            </div>

            {planUsage?.jobPosts.reached && (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                You have reached your Free plan limit of {planUsage.jobPosts.limit} active
                job posts. Close a job, or contact SEH to upgrade to Pro.
              </p>
            )}

            {mutation.isError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : 'Job could not be created.'}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                type="submit"
                isLoading={mutation.isPending}
                disabled={planUsage?.jobPosts.reached}
              >
                <Send className="h-4 w-4" />
                Publish job
              </Button>
              <Button
                type="button"
                variant="secondary"
                disabled={mutation.isPending}
                onClick={handleSubmit((data) => saveJob(data, 'draft'))}
              >
                Save draft
              </Button>
              <Link to="/hr/jobs">
                <Button type="button" variant="ghost" disabled={mutation.isPending}>
                  Cancel
                </Button>
              </Link>
            </div>
          </CardBody>
        </Card>
      </form>
    </div>
  )
}
