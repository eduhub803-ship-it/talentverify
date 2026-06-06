import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft } from 'lucide-react'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Button } from '@/features/shared/components/ui/Button'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Input } from '@/features/shared/components/ui/Input'
import { useAuthStore } from '@/stores/auth-store'
import { createHrJob } from '../actions'
import { jobSchema, type JobForm } from '../schemas/job.schema'
import { notificationsQueryKeys } from '@/features/notifications/queryKeys'

function parseRequirements(value?: string): string[] {
  return (value ?? '')
    .split('\n')
    .flatMap((line) => line.split(','))
    .map((item) => item.trim())
    .filter(Boolean)
}

export function CreateJobPage() {
  const userId = useAuthStore((s) => s.profile!.id)
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
    mutationFn: (data: JobForm) =>
      createHrJob(userId, {
        title: data.title,
        description: data.description,
        requirements: parseRequirements(data.requirements),
        experienceLevel: data.experienceLevel || null,
        location: data.location,
        jobType: data.jobType,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['jobs', 'hr', userId] })
      qc.invalidateQueries({ queryKey: notificationsQueryKeys.root })
      navigate('/hr/jobs')
    },
  })

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

      <form onSubmit={handleSubmit((data) => mutation.mutate(data))}>
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
            {mutation.isError && (
              <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {mutation.error instanceof Error
                  ? mutation.error.message
                  : 'Job could not be created.'}
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button type="submit" isLoading={mutation.isPending}>
                Create Job
              </Button>
              <Link to="/hr/jobs">
                <Button type="button" variant="secondary">
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
