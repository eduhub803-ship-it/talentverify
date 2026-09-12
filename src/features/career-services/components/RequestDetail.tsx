import { useContext } from 'react'
import { CalendarClock, CheckCircle2, FileText } from 'lucide-react'
import { Badge } from '@/features/shared/components/ui/Badge'
import { Button } from '@/features/shared/components/ui/Button'
import { LanguageContext } from '@/context/LanguageContext'
import { formatDate } from '@/lib/utils'
import type { CareerService, CareerServiceRequest } from '@/types/domain'
import { STATUS_LABELS, STATUS_LABELS_AR } from '../rules'
import { getCareerService } from '../catalog'

/** Candidate-facing view of one request. Internal staff notes are never passed in. */
export function RequestDetail({
  request,
  service,
  canCancel,
  isCancelling,
  onCancel,
  onClose,
}: {
  request: CareerServiceRequest
  service: CareerService
  canCancel: boolean
  isCancelling: boolean
  onCancel: () => void
  onClose: () => void
}) {
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)
  const isArabic = language?.lang === 'ar'
  const statusLabel = isArabic
    ? STATUS_LABELS_AR[request.status]
    : STATUS_LABELS[request.status]
  const result = request.result
  const followUp =
    request.status === 'completed' && service.followUpServiceCode
      ? getCareerService(service.followUpServiceCode)
      : undefined

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {isArabic ? service.nameAr : service.name}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t('careerServices.requestedOn')} {formatDate(request.submittedAt)}
          </p>
        </div>
        <Badge variant={request.status === 'completed' ? 'success' : 'default'}>
          {statusLabel}
        </Badge>
      </div>

      {request.paymentStatus !== 'not_required' && (
        <div className="rounded-lg border border-border px-3 py-2 text-sm">
          <div>
            <span className="text-muted">{t('careerServices.payment')}: </span>
            <span className="font-medium text-foreground">
              {t(`careerServices.paymentStatus.${request.paymentStatus}`)}
            </span>
          </div>
          {request.paymentStatus === 'pending' && (
            <p className="mt-1 text-xs text-muted">
              {t('careerServices.awaitingPaymentNote')}
            </p>
          )}
        </div>
      )}

      {request.scheduledAt && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary-50/40 px-3 py-2 text-sm">
          <CalendarClock className="h-4 w-4 text-primary" />
          <span>
            {t('careerServices.scheduledFor')}{' '}
            <span className="font-medium">{formatDate(request.scheduledAt)}</span>
          </span>
        </div>
      )}

      {request.adminMessage && request.status !== 'completed' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {request.adminMessage}
        </div>
      )}

      {result && (
        <div className="space-y-4 rounded-xl border border-border p-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
            <div>
              <h3 className="font-semibold text-foreground">
                {t('careerServices.result')}
              </h3>
              <p className="mt-1 text-sm text-foreground">{result.summary}</p>
            </div>
          </div>

          {service.selfService ? (
            <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted">
              {t('careerServices.selfAssessmentNote')}
            </p>
          ) : (
            (result.strengths?.length || result.gaps?.length) && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted">
                {t('careerServices.advisoryNote')}
              </p>
            )
          )}

          {typeof result.score === 'number' && (
            <div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted">{t('careerServices.readinessScore')}</span>
                <span className="font-semibold text-foreground">
                  {result.score}/100 {result.scoreLabel ? `· ${result.scoreLabel}` : ''}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                <div className="h-full bg-primary" style={{ width: `${result.score}%` }} />
              </div>
            </div>
          )}

          {result.strengths && result.strengths.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-foreground">
                {t('careerServices.strengths')}
              </h4>
              <ul className="mt-1 space-y-1 text-sm text-muted">
                {result.strengths.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          )}

          {result.gaps && result.gaps.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-foreground">
                {t('careerServices.gaps')}
              </h4>
              <ul className="mt-1 space-y-1 text-sm text-muted">
                {result.gaps.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          )}

          {result.improvementAreas &&
            result.improvementAreas.length > 0 &&
            !result.gaps?.length && (
              <div>
                <h4 className="text-sm font-medium text-foreground">
                  {t('careerServices.improvementAreas')}
                </h4>
              <ul className="mt-1 space-y-1 text-sm text-muted">
                {result.improvementAreas.map((area) => (
                  <li key={area}>• {area}</li>
                ))}
              </ul>
            </div>
          )}

          {result.recommendations && result.recommendations.length > 0 && (
            <div>
              <h4 className="text-sm font-medium text-foreground">
                {t('careerServices.recommendations')}
              </h4>
              <ul className="mt-1 space-y-1 text-sm text-muted">
                {result.recommendations.map((item) => (
                  <li key={item}>• {item}</li>
                ))}
              </ul>
            </div>
          )}

          {result.deliverableUrl && (
            <a href={result.deliverableUrl} target="_blank" rel="noopener noreferrer">
              <Button type="button" variant="secondary" size="sm">
                <FileText className="h-4 w-4" />
                {result.deliverableName ?? t('careerServices.openDeliverable')}
              </Button>
            </a>
          )}
        </div>
      )}

      {Object.keys(request.candidateInput).length > 0 && (
        <div className="rounded-xl border border-border p-4">
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            {t('careerServices.yourInformation')}
          </h3>
          <dl className="space-y-2 text-sm">
            {service.inputFields
              .filter((field) => request.candidateInput[field.key])
              .map((field) => (
                <div key={field.key} className="flex flex-col gap-0.5">
                  <dt className="text-xs text-muted">
                    {isArabic ? field.labelAr : field.label}
                  </dt>
                  <dd className="whitespace-pre-line break-words text-foreground">
                    {field.type === 'boolean'
                      ? request.candidateInput[field.key] === 'true'
                        ? t('careerServices.yes')
                        : t('careerServices.no')
                      : request.candidateInput[field.key]}
                  </dd>
                </div>
              ))}
          </dl>
          {request.candidateNotes && (
            <p className="mt-3 whitespace-pre-line break-words text-sm text-muted">
              {request.candidateNotes}
            </p>
          )}
        </div>
      )}

      {followUp?.active && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-muted">
          {t('careerServices.suggestedNextStep')}{' '}
          <span className="font-medium text-foreground">
            {isArabic ? followUp.nameAr : followUp.name}
          </span>
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        {canCancel && (
          <Button
            type="button"
            variant="danger"
            isLoading={isCancelling}
            onClick={onCancel}
          >
            {t('careerServices.cancelRequest')}
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('careerServices.close')}
        </Button>
      </div>
    </div>
  )
}
