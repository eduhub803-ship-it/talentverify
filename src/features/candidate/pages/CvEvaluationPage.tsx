import { useContext, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Input } from '@/features/shared/components/ui/Input'
import { Button } from '@/features/shared/components/ui/Button'
import { UsageLimitError } from '@/lib/errors'
import { useAuthStore } from '@/stores/auth-store'
import {
  evaluateMyCv,
  fetchCvEvaluationUsage,
  getCvEvaluationRemaining,
} from '../actions'
import { CvEvaluationResults } from '../components/CvEvaluationResults'
import { UpgradePrompt } from '@/features/shared/components/feedback/UpgradePrompt'
import { LanguageContext } from '@/context/LanguageContext'

export function CvEvaluationPage() {
  const userId = useAuthStore((s) => s.profile!.id)
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)
  const [jobTitle, setJobTitle] = useState('')
  const [jobDescription, setJobDescription] = useState('')
  const [limitHit, setLimitHit] = useState(false)

  const { data: usage, refetch: refetchUsage } = useQuery({
    queryKey: ['candidate', 'usage', 'cv_evaluation', userId],
    queryFn: () => fetchCvEvaluationUsage(userId),
  })

  const remaining = usage ? getCvEvaluationRemaining(usage) : 2

  const evaluation = useMutation({
    mutationFn: () =>
      evaluateMyCv(userId, {
        jobTitle: jobTitle.trim(),
        jobDescription: jobDescription.trim() || undefined,
      }),
    onSuccess: () => {
      setLimitHit(false)
      refetchUsage()
    },
    onError: (e) => {
      if (e instanceof UsageLimitError) setLimitHit(true)
    },
  })

  return (
    <div>
      <PageHeader
        title={t('cvEvaluation.title')}
        description={t('cvEvaluation.description')}
        actions={
          <span className="rounded-full bg-primary-50 px-3 py-1 text-sm font-medium text-primary">
            {t('cvEvaluation.remaining')
              .replace('{count}', String(remaining))
              .replace('{plural}', remaining === 1 ? '' : 's')}
          </span>
        }
      />

      {limitHit && <UpgradePrompt className="mb-6" />}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody className="space-y-4">
            <Input
              label={t('cvEvaluation.jobTitle')}
              required
              placeholder={t('cvEvaluation.jobTitlePlaceholder')}
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium">
                {t('cvEvaluation.jobDescription')}
              </label>
              <textarea
                className="min-h-[160px] w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                placeholder={t('cvEvaluation.jobDescriptionPlaceholder')}
                value={jobDescription}
                onChange={(e) => setJobDescription(e.target.value)}
              />
            </div>
            {evaluation.isError && !(evaluation.error instanceof UsageLimitError) && (
              <p className="text-sm text-red-600">
                {evaluation.error instanceof Error
                  ? evaluation.error.message
                  : t('cvEvaluation.failed')}
              </p>
            )}
            <Button
              className="w-full"
              disabled={!jobTitle.trim() || remaining === 0}
              isLoading={evaluation.isPending}
              onClick={() => evaluation.mutate()}
            >
              <Sparkles className="h-4 w-4" />
              {t('cvEvaluation.submit')}
            </Button>
          </CardBody>
        </Card>

        {evaluation.data && (
          <CvEvaluationResults result={evaluation.data} />
        )}
      </div>
    </div>
  )
}
