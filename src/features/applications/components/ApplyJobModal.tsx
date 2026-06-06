import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { FileText, X } from 'lucide-react'
import { Badge } from '@/features/shared/components/ui/Badge'
import { Button } from '@/features/shared/components/ui/Button'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { FileUpload } from '@/features/shared/components/ui/FileUpload'
import { cn } from '@/lib/utils'
import type { CandidateJobApplicationContext, Job } from '@/types/domain'
import { applyToJob } from '../actions'

export function ApplyJobModal({
  job,
  candidateId,
  context,
  onClose,
  onApplied,
}: {
  job: Job | null
  candidateId: string
  context: CandidateJobApplicationContext
  onClose: () => void
  onApplied: () => void
}) {
  const [message, setMessage] = useState('')
  const [cvFile, setCvFile] = useState<File | null>(null)
  const [useExistingCv, setUseExistingCv] = useState(Boolean(context.existingCvUrl))

  const mutation = useMutation({
    mutationFn: () =>
      applyToJob({
        jobId: job!.id,
        candidateId,
        message,
        cvFile,
        useExistingCv: useExistingCv && !cvFile,
      }),
    onSuccess: onApplied,
  })

  if (!job) return null

  const canSubmit = Boolean(cvFile || (useExistingCv && context.existingCvUrl))

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center px-4 py-6">
      <button
        type="button"
        className="fixed inset-0 bg-black/40"
        aria-label="Close apply form"
        onClick={onClose}
      />
      <Card className="relative z-10 max-h-[calc(100vh-48px)] w-full max-w-xl overflow-y-auto">
        <CardBody className="space-y-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Apply to {job.title}</h2>
              <p className="mt-1 text-sm text-muted">{job.location}</p>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>

          {context.existingCvUrl && (
            <button
              type="button"
              className={cn(
                'flex w-full items-center justify-between rounded-lg border px-4 py-3 text-left transition-colors',
                useExistingCv && !cvFile
                  ? 'border-primary bg-primary-50/50'
                  : 'border-border bg-white hover:bg-slate-50',
              )}
              onClick={() => {
                setUseExistingCv(true)
                setCvFile(null)
              }}
            >
              <span className="flex min-w-0 items-center gap-3">
                <FileText className="h-5 w-5 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-sm font-medium text-foreground">
                    Use existing CV
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {context.existingCvName}
                  </span>
                </span>
              </span>
              {useExistingCv && !cvFile && <Badge variant="primary">Selected</Badge>}
            </button>
          )}

          <FileUpload
            label={cvFile ? cvFile.name : 'Upload a CV for this application'}
            disabled={mutation.isPending}
            onFile={(file) => {
              setCvFile(file)
              setUseExistingCv(false)
            }}
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-foreground">
              Message
            </label>
            <textarea
              className="min-h-[110px] w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
              placeholder="Optional message to the hiring team."
              value={message}
              onChange={(event) => setMessage(event.target.value)}
            />
          </div>

          {mutation.isError && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {mutation.error instanceof Error
                ? mutation.error.message
                : 'Application could not be submitted.'}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              disabled={!canSubmit}
              isLoading={mutation.isPending}
              onClick={() => mutation.mutate()}
            >
              Submit Application
            </Button>
            <Button type="button" variant="secondary" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </CardBody>
      </Card>
    </div>
  )
}
