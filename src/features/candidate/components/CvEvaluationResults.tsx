import { useContext } from 'react'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { LanguageContext } from '@/context/LanguageContext'
import type { CvEvaluationResult } from '@/types/domain'

export function CvEvaluationResults({ result }: { result: CvEvaluationResult }) {
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

  return (
    <Card className="border-primary/20">
      <CardBody className="space-y-6">
        <div className="text-center">
          <p className="text-sm font-medium text-muted">
            {t('cvEvaluationResults.matchScore')}
          </p>
          <p className="text-5xl font-semibold text-primary">{result.matchScore}</p>
          <p className="text-xs text-muted">{t('cvEvaluationResults.outOf100')}</p>
        </div>

        <ResultSection
          title={t('cvEvaluationResults.strengths')}
          items={result.strengths}
          variant="success"
        />
        <ResultSection
          title={t('cvEvaluationResults.weaknesses')}
          items={result.weaknesses}
          variant="warning"
        />
        <ResultSection
          title={t('cvEvaluationResults.missingSkills')}
          items={result.missingSkills}
        />
        <ResultSection
          title={t('cvEvaluationResults.careerSuggestions')}
          items={result.careerSuggestions}
        />
      </CardBody>
    </Card>
  )
}

function ResultSection({
  title,
  items,
  variant,
}: {
  title: string
  items: string[]
  variant?: 'success' | 'warning'
}) {
  if (items.length === 0) return null
  const color =
    variant === 'success'
      ? 'text-success'
      : variant === 'warning'
        ? 'text-warning'
        : 'text-foreground'

  return (
    <div>
      <h3 className={`text-sm font-semibold ${color}`}>{title}</h3>
      <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-muted">
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  )
}
