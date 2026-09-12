import { useContext, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, X } from 'lucide-react'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Button } from '@/features/shared/components/ui/Button'
import { Badge } from '@/features/shared/components/ui/Badge'
import { Input } from '@/features/shared/components/ui/Input'
import { LanguageContext } from '@/context/LanguageContext'
import { useAuthStore } from '@/stores/auth-store'
import { formatDate } from '@/lib/utils'
import { notificationsQueryKeys } from '@/features/notifications/queryKeys'
import type { EmployerService, EmployerServiceRequest } from '@/types/domain'
import {
  candidateCanCancel,
  STATUS_LABELS,
  STATUS_LABELS_AR,
} from '@/features/career-services/rules'
import { EMPLOYER_SERVICES, getEmployerService } from '../catalog'
import {
  cancelEmployerRequest,
  fetchMyEmployerRequests,
  requestEmployerService,
} from '../actions'
import { employerQueryKeys } from '../queryKeys'
import { SubmittedShortlist } from '../components/SubmittedShortlist'

/** Services 35 and 36, using the shared Career Services status vocabulary. */
export function EmployerServicesPage() {
  const actor = useAuthStore((state) => state.profile)
  const qc = useQueryClient()
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)
  const isArabic = language?.lang === 'ar'

  const [dialog, setDialog] = useState<
    { kind: 'request'; service: EmployerService } | { kind: 'detail'; request: EmployerServiceRequest } | null
  >(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [notes, setNotes] = useState('')
  const [error, setError] = useState<string | null>(null)

  const { data: requests = [], error: queryError } = useQuery({
    queryKey: employerQueryKeys.myRequests(actor?.id ?? 'anonymous'),
    queryFn: () => fetchMyEmployerRequests(actor),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: employerQueryKeys.root })
    qc.invalidateQueries({ queryKey: notificationsQueryKeys.root })
  }

  const create = useMutation({
    mutationFn: (service: EmployerService) =>
      requestEmployerService({
        actor,
        serviceCode: service.code,
        values,
        notes,
      }),
    onSuccess: (request) => {
      invalidate()
      setValues({})
      setNotes('')
      setError(null)
      setDialog({ kind: 'detail', request })
    },
    onError: (mutationError) =>
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'This request could not be submitted.',
      ),
  })

  const cancel = useMutation({
    mutationFn: (request: EmployerServiceRequest) =>
      cancelEmployerRequest({ actor, requestId: request.id }),
    onSuccess: (request) => {
      invalidate()
      setError(null)
      setDialog({ kind: 'detail', request })
    },
    onError: (mutationError) =>
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'This request could not be cancelled.',
      ),
  })

  const latestFor = (code: string) =>
    requests.find((request) => request.serviceCode === code)

  const statusLabel = (request: EmployerServiceRequest) =>
    isArabic ? STATUS_LABELS_AR[request.status] : STATUS_LABELS[request.status]

  if (queryError) {
    return (
      <div>
        <PageHeader title={t('employerServices.title')} />
        <Card>
          <CardBody>
            <div className="flex items-start gap-2 text-sm text-muted">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                {queryError instanceof Error
                  ? queryError.message
                  : t('employerServices.unavailable')}
              </span>
            </div>
          </CardBody>
        </Card>
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={t('employerServices.title')}
        description={t('employerServices.description')}
      />

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        {EMPLOYER_SERVICES.filter(
          (service) =>
            service.active ||
            requests.some((request) => request.serviceCode === service.code),
        ).map((service) => {
          const request = latestFor(service.code)
          const live = request && !['completed', 'cancelled'].includes(request.status)

          return (
            <Card key={service.code} className="h-full">
              <CardBody className="flex h-full flex-col">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-semibold text-foreground">
                    {isArabic ? service.nameAr : service.name}
                  </h3>
                  <Badge
                    variant={service.pricingType === 'premium' ? 'primary' : 'warning'}
                    className="shrink-0"
                  >
                    {t(`careerServices.pricing.${service.pricingType}`)}
                  </Badge>
                </div>

                <p className="mt-2 text-sm text-muted">
                  {isArabic ? service.descriptionAr : service.description}
                </p>

                {request && (
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant={request.status === 'completed' ? 'success' : 'default'}>
                      {statusLabel(request)}
                    </Badge>
                    {request.scheduledAt && (
                      <span className="inline-flex items-center gap-1 text-muted">
                        <CalendarClock className="h-3.5 w-3.5" />
                        {formatDate(request.scheduledAt)}
                      </span>
                    )}
                  </div>
                )}

                <div className="mt-auto pt-4">
                  {!service.active && !request ? (
                    <Badge variant="default">{t('employerServices.managedBySeh')}</Badge>
                  ) : !service.active && request ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setError(null)
                        setDialog({ kind: 'detail', request })
                      }}
                    >
                      {t('employerServices.viewRequest')}
                    </Button>
                  ) : request && (live || request.status === 'completed') ? (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => {
                        setError(null)
                        setDialog({ kind: 'detail', request })
                      }}
                    >
                      {request.status === 'completed'
                        ? t('employerServices.viewResult')
                        : t('employerServices.viewRequest')}
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => {
                        setError(null)
                        setValues({})
                        setNotes('')
                        setDialog({ kind: 'request', service })
                      }}
                    >
                      {t('employerServices.request')}
                      <ArrowRight className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </CardBody>
            </Card>
          )
        })}
      </div>

      {dialog && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-8">
          <button
            type="button"
            aria-label={t('employerServices.close')}
            className="fixed inset-0 bg-black/40"
            onClick={() => setDialog(null)}
          />
          <Card className="relative z-10 w-full max-w-2xl">
            <CardBody className="space-y-5">
              <div className="flex justify-end">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setDialog(null)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              {dialog.kind === 'request' ? (
                <>
                  <div>
                    <h2 className="text-lg font-semibold text-foreground">
                      {isArabic ? dialog.service.nameAr : dialog.service.name}
                    </h2>
                    <p className="mt-1 text-sm text-muted">
                      {isArabic
                        ? dialog.service.descriptionAr
                        : dialog.service.description}
                    </p>
                  </div>

                  <div className="space-y-4">
                    {dialog.service.inputFields.map((field) => {
                      const label = isArabic ? field.labelAr : field.label
                      const help = isArabic ? field.helpTextAr : field.helpText
                      const value = values[field.key] ?? ''

                      if (field.type === 'select') {
                        return (
                          <div key={field.key} className="space-y-1.5">
                            <label className="block text-sm font-medium text-foreground">
                              {label}
                              {field.required && ' *'}
                            </label>
                            <select
                              className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm"
                              value={value}
                              onChange={(event) =>
                                setValues({ ...values, [field.key]: event.target.value })
                              }
                            >
                              <option value="">{t('careerServices.choose')}</option>
                              {field.options?.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {isArabic ? option.labelAr : option.label}
                                </option>
                              ))}
                            </select>
                          </div>
                        )
                      }

                      if (field.type === 'textarea') {
                        return (
                          <div key={field.key} className="space-y-1.5">
                            <label className="block text-sm font-medium text-foreground">
                              {label}
                              {field.required && ' *'}
                            </label>
                            <textarea
                              className="min-h-[110px] w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                              value={value}
                              onChange={(event) =>
                                setValues({ ...values, [field.key]: event.target.value })
                              }
                            />
                            {help && <p className="text-xs text-muted">{help}</p>}
                          </div>
                        )
                      }

                      return (
                        <Input
                          key={field.key}
                          label={`${label}${field.required ? ' *' : ''}`}
                          placeholder={field.placeholder}
                          hint={help}
                          value={value}
                          onChange={(event) =>
                            setValues({ ...values, [field.key]: event.target.value })
                          }
                        />
                      )
                    })}

                    <div className="space-y-1.5">
                      <label className="block text-sm font-medium text-foreground">
                        {t('employerServices.notes')}
                      </label>
                      <textarea
                        className="min-h-[80px] w-full rounded-lg border border-border bg-white px-3 py-2 text-sm"
                        value={notes}
                        onChange={(event) => setNotes(event.target.value)}
                      />
                    </div>
                  </div>

                  <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted">
                    {t('employerServices.paymentNote')}
                  </p>

                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      isLoading={create.isPending}
                      onClick={() => create.mutate(dialog.service)}
                    >
                      {t('employerServices.submit')}
                    </Button>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => setDialog(null)}
                    >
                      {t('employerServices.cancel')}
                    </Button>
                  </div>
                </>
              ) : (
                <RequestView
                  request={dialog.request}
                  service={getEmployerService(dialog.request.serviceCode)}
                  isArabic={isArabic}
                  t={t}
                  isCancelling={cancel.isPending}
                  onCancel={() => cancel.mutate(dialog.request)}
                  onClose={() => setDialog(null)}
                />
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  )
}

function RequestView({
  request,
  service,
  isArabic,
  t,
  isCancelling,
  onCancel,
  onClose,
}: {
  request: EmployerServiceRequest
  service: EmployerService | undefined
  isArabic: boolean
  t: (key: string) => string
  isCancelling: boolean
  onCancel: () => void
  onClose: () => void
}) {
  const result = request.result
  const canCancel = candidateCanCancel(request)

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            {isArabic ? service?.nameAr : service?.name}
          </h2>
          <p className="mt-1 text-sm text-muted">
            {t('employerServices.requestedOn')} {formatDate(request.submittedAt)}
          </p>
        </div>
        <Badge variant={request.status === 'completed' ? 'success' : 'default'}>
          {isArabic ? STATUS_LABELS_AR[request.status] : STATUS_LABELS[request.status]}
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
            <p className="mt-1 text-xs text-muted">{t('employerServices.paymentNote')}</p>
          )}
        </div>
      )}

      {request.scheduledAt && (
        <div className="flex items-center gap-2 rounded-lg border border-primary/30 bg-primary-50/40 px-3 py-2 text-sm">
          <CalendarClock className="h-4 w-4 text-primary" />
          <span>
            {t('employerServices.scheduledFor')}{' '}
            <span className="font-medium">{formatDate(request.scheduledAt)}</span>
          </span>
        </div>
      )}

      {request.adminMessage && request.status !== 'completed' && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          {request.adminMessage}
        </div>
      )}

      {request.serviceCode === '34' && <SubmittedShortlist request={request} t={t} />}

      {result && (
        <div className="space-y-3 rounded-xl border border-border p-4">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="mt-0.5 h-5 w-5 text-success" />
            <div>
              <h3 className="font-semibold text-foreground">
                {t('employerServices.result')}
              </h3>
              <p className="mt-1 text-sm text-foreground">{result.summary}</p>
            </div>
          </div>
          {(['strengths', 'gaps', 'recommendations'] as const).map((key) =>
            result[key] && result[key]!.length > 0 ? (
              <div key={key}>
                <h4 className="text-sm font-medium text-foreground">
                  {t(`careerServices.${key === 'gaps' ? 'gaps' : key}`)}
                </h4>
                <ul className="mt-1 space-y-1 text-sm text-muted">
                  {result[key]!.map((item) => (
                    <li key={item}>• {item}</li>
                  ))}
                </ul>
              </div>
            ) : null,
          )}
          {result.deliverableUrl && (
            <a href={result.deliverableUrl} target="_blank" rel="noopener noreferrer">
              <Button type="button" size="sm" variant="secondary">
                {result.deliverableName ?? t('careerServices.openDeliverable')}
              </Button>
            </a>
          )}
        </div>
      )}

      {Object.keys(request.input).length > 0 && service && (
        <div className="rounded-xl border border-border p-4">
          <h3 className="mb-2 text-sm font-semibold text-foreground">
            {t('employerServices.yourInformation')}
          </h3>
          <dl className="space-y-2 text-sm">
            {service.inputFields
              .filter((field) => request.input[field.key])
              .map((field) => (
                <div key={field.key}>
                  <dt className="text-xs text-muted">
                    {isArabic ? field.labelAr : field.label}
                  </dt>
                  <dd className="whitespace-pre-line break-words text-foreground">
                    {request.input[field.key]}
                  </dd>
                </div>
              ))}
          </dl>
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {canCancel && (
          <Button
            type="button"
            variant="danger"
            isLoading={isCancelling}
            onClick={onCancel}
          >
            {t('employerServices.cancelRequest')}
          </Button>
        )}
        <Button type="button" variant="secondary" onClick={onClose}>
          {t('employerServices.close')}
        </Button>
      </div>
    </div>
  )
}
