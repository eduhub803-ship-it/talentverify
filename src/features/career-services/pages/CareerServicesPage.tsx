import { useContext, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, ArrowRight, CalendarClock, Sparkles, X } from 'lucide-react'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Button } from '@/features/shared/components/ui/Button'
import { Badge } from '@/features/shared/components/ui/Badge'
import { Skeleton } from '@/features/shared/components/ui/Skeleton'
import { LanguageContext } from '@/context/LanguageContext'
import { useAuthStore } from '@/stores/auth-store'
import { formatDate } from '@/lib/utils'
import { fetchMyCandidateProfile, fetchMyDocuments } from '@/features/candidate/actions'
import { notificationsQueryKeys } from '@/features/notifications/queryKeys'
import type { CareerService, CareerServiceRequest } from '@/types/domain'
import {
  CAREER_SERVICE_CATEGORIES,
  CAREER_SERVICES,
  getCareerService,
  servicesInCategory,
} from '../catalog'
import {
  candidateCanCancel,
  candidateMustRespond,
  deliverableKeyFor,
  isActiveRequest,
  prefillFromPassport,
  prerequisiteState,
  recommendedServices,
  STATUS_LABELS,
  STATUS_LABELS_AR,
} from '../rules'
import {
  cancelCareerServiceRequest,
  fetchMyCareerRequests,
  requestCareerService,
  submitCareerRequestInformation,
  submitSelfServiceAssessment,
} from '../actions'
import { careerServicesQueryKeys } from '../queryKeys'
import { ServiceRequestForm } from '../components/ServiceRequestForm'
import { RequestDetail } from '../components/RequestDetail'

type Dialog =
  | { kind: 'request'; service: CareerService }
  | { kind: 'detail'; request: CareerServiceRequest }
  | { kind: 'respond'; request: CareerServiceRequest }
  | null

function pricingVariant(service: CareerService) {
  if (service.pricingType === 'free') return 'success' as const
  if (service.pricingType === 'premium') return 'primary' as const
  return 'warning' as const
}

export function CareerServicesPage() {
  const actor = useAuthStore((state) => state.profile)
  const candidateId = actor!.id
  const qc = useQueryClient()
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)
  const isArabic = language?.lang === 'ar'
  const [dialog, setDialog] = useState<Dialog>(null)
  const [error, setError] = useState<string | null>(null)

  const { data: requests = [], isLoading } = useQuery({
    queryKey: careerServicesQueryKeys.mine(candidateId),
    queryFn: () => fetchMyCareerRequests(candidateId),
  })

  const { data: profile } = useQuery({
    queryKey: ['candidate', 'profile', candidateId],
    queryFn: () => fetchMyCandidateProfile(candidateId),
  })

  const { data: documents = [] } = useQuery({
    queryKey: ['candidate', 'documents', candidateId],
    queryFn: () => fetchMyDocuments(candidateId),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: careerServicesQueryKeys.root })
    qc.invalidateQueries({ queryKey: notificationsQueryKeys.root })
  }

  const requestMutation = useMutation({
    mutationFn: async ({
      service,
      values,
      notes,
    }: {
      service: CareerService
      values: Record<string, string>
      notes: string
    }) => {
      if (service.selfService) {
        return submitSelfServiceAssessment({
          actor,
          candidateId,
          serviceCode: service.code,
          answers: values,
          profile,
          documents,
        })
      }
      return requestCareerService({
        actor,
        candidateId,
        serviceCode: service.code,
        candidateInput: values,
        candidateNotes: notes,
      })
    },
    onSuccess: (request) => {
      invalidate()
      setError(null)
      setDialog({ kind: 'detail', request })
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'This request could not be submitted.',
      )
    },
  })

  const respondMutation = useMutation({
    mutationFn: ({
      request,
      values,
      notes,
    }: {
      request: CareerServiceRequest
      values: Record<string, string>
      notes: string
    }) =>
      submitCareerRequestInformation({
        actor,
        requestId: request.id,
        candidateId,
        values,
        notes,
      }),
    onSuccess: (request) => {
      invalidate()
      setError(null)
      setDialog({ kind: 'detail', request })
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'Your information could not be submitted.',
      )
    },
  })

  const cancelMutation = useMutation({
    mutationFn: (request: CareerServiceRequest) =>
      cancelCareerServiceRequest({ actor, requestId: request.id, candidateId }),
    onSuccess: (request) => {
      invalidate()
      setError(null)
      setDialog({ kind: 'detail', request })
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'This request could not be cancelled.',
      )
    },
  })

  /** Latest request per service drives the card's primary action. */
  const latestByService = useMemo(() => {
    const map = new Map<string, CareerServiceRequest>()
    for (const request of requests) {
      const current = map.get(request.serviceCode)
      if (!current || request.submittedAt > current.submittedAt) {
        map.set(request.serviceCode, request)
      }
    }
    return map
  }, [requests])

  const actionable = requests.filter(
    (request) => candidateMustRespond(request) || request.status === 'scheduled',
  )

  const recommended = useMemo(
    () =>
      recommendedServices({
        services: CAREER_SERVICES,
        profile,
        documents,
        requests,
      }),
    [profile, documents, requests],
  )

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    )
  }

  const renderCard = (service: CareerService) => {
    const request = latestByService.get(service.code)
    const live = request && isActiveRequest(request)
    const statusLabel = request
      ? isArabic
        ? STATUS_LABELS_AR[request.status]
        : STATUS_LABELS[request.status]
      : null
    const prerequisite = prerequisiteState(service, requests)
    const prerequisiteService = prerequisite.serviceCode
      ? getCareerService(prerequisite.serviceCode)
      : null

    let primary: React.ReactNode

    if (!service.active) {
      // Roadmap entry: shown so the offering is visible, with no actionable CTA.
      primary = (
        <Badge variant="default">{t('careerServices.comingSoon')}</Badge>
      )
    } else if (request && candidateMustRespond(request)) {
      primary = (
        <Button
          size="sm"
          onClick={() => {
            setError(null)
            setDialog({ kind: 'respond', request })
          }}
        >
          {t('careerServices.provideInformation')}
        </Button>
      )
    } else if (request && (live || (request.status === 'completed' && !service.allowsRepeatRequests))) {
      primary = (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setError(null)
            setDialog({ kind: 'detail', request })
          }}
        >
          {request.status === 'completed'
            ? t('careerServices.viewResult')
            : request.status === 'scheduled'
              ? t('careerServices.viewAppointment')
              : t('careerServices.viewRequest')}
        </Button>
      )
    } else if (prerequisite.required && !prerequisite.met && prerequisiteService) {
      // No dead CTA: route to the prerequisite instead of offering a request
      // the backend would reject.
      primary = (
        <Button
          size="sm"
          variant="secondary"
          onClick={() => {
            setError(null)
            setDialog({ kind: 'request', service: prerequisiteService })
          }}
        >
          {t('careerServices.completePrerequisite')}
        </Button>
      )
    } else {
      primary = (
        <Button
          size="sm"
          onClick={() => {
            setError(null)
            setDialog({ kind: 'request', service })
          }}
        >
          {service.selfService
            ? t('careerServices.startCheck')
            : service.requiresJobDescription
              ? t('careerServices.provideVacancy')
              : t('careerServices.request')}
          <ArrowRight className="h-4 w-4" />
        </Button>
      )
    }

    return (
      <Card
        key={service.code}
        className={service.active ? 'h-full' : 'h-full opacity-70'}
      >
        <CardBody className="flex h-full flex-col">
          <div className="flex items-start justify-between gap-3">
            <h3 className="font-semibold text-foreground">
              {isArabic ? service.nameAr : service.name}
            </h3>
            <Badge
              variant={service.active ? pricingVariant(service) : 'default'}
              className="shrink-0"
            >
              {t(`careerServices.pricing.${service.pricingType}`)}
            </Badge>
          </div>

          <p className="mt-2 text-sm text-muted">
            {isArabic ? service.descriptionAr : service.description}
          </p>

          {service.active && (
            <p className="mt-2 text-xs text-muted">{t(deliverableKeyFor(service))}</p>
          )}

          {service.pricingNote && (
            <p className="mt-1 text-xs text-muted">
              {isArabic ? service.pricingNoteAr : service.pricingNote}
            </p>
          )}

          {service.active && prerequisite.required && !prerequisite.met && (
            <p className="mt-2 text-xs text-warning">
              {t('careerServices.requiresFirst')}{' '}
              {isArabic ? prerequisiteService?.nameAr : prerequisiteService?.name}
            </p>
          )}

          {request && (
            <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
              <Badge variant={request.status === 'completed' ? 'success' : 'default'}>
                {statusLabel}
              </Badge>
              {request.scheduledAt && (
                <span className="inline-flex items-center gap-1 text-muted">
                  <CalendarClock className="h-3.5 w-3.5" />
                  {formatDate(request.scheduledAt)}
                </span>
              )}
            </div>
          )}

          <div className="mt-auto pt-4">{primary}</div>
        </CardBody>
      </Card>
    )
  }

  return (
    <div>
      <PageHeader
        title={t('careerServices.title')}
        description={t('careerServices.description')}
      />

      {error && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {actionable.length > 0 && (
        <Card className="mb-8 border-primary/30 bg-primary-50/30">
          <CardBody className="space-y-3">
            <h2 className="font-semibold text-foreground">
              {t('careerServices.needsYourAttention')}
            </h2>
            {actionable.map((request) => {
              const service = getCareerService(request.serviceCode)
              return (
                <div
                  key={request.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border bg-white px-3 py-2"
                >
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {isArabic ? service?.nameAr : service?.name}
                    </p>
                    <p className="text-xs text-muted">
                      {candidateMustRespond(request)
                        ? (request.adminMessage ?? t('careerServices.informationRequired'))
                        : `${t('careerServices.scheduledFor')} ${formatDate(request.scheduledAt)}`}
                    </p>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => {
                      setError(null)
                      setDialog(
                        candidateMustRespond(request)
                          ? { kind: 'respond', request }
                          : { kind: 'detail', request },
                      )
                    }}
                  >
                    {candidateMustRespond(request)
                      ? t('careerServices.provideInformation')
                      : t('careerServices.viewAppointment')}
                  </Button>
                </div>
              )
            })}
          </CardBody>
        </Card>
      )}

      {recommended.length > 0 && (
        <section className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-foreground">
              {t('careerServices.recommended')}
            </h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {recommended.map(renderCard)}
          </div>
        </section>
      )}

      {CAREER_SERVICE_CATEGORIES.map((category) => {
        const services = servicesInCategory(category.key)
        if (services.length === 0) return null
        return (
          <section key={category.key} className="mb-8">
            <h2 className="font-semibold text-foreground">
              {isArabic ? category.labelAr : category.label}
            </h2>
            <p className="mb-3 text-sm text-muted">
              {isArabic ? category.descriptionAr : category.description}
            </p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {services.map(renderCard)}
            </div>
          </section>
        )
      })}

      {dialog && (
        <Modal onClose={() => setDialog(null)}>
          {dialog.kind === 'request' && (
            <ServiceRequestForm
              service={dialog.service}
              initialValues={prefillFromPassport(dialog.service, profile)}
              myRequests={requests}
              isSubmitting={requestMutation.isPending}
              submitLabel={
                dialog.service.code === '07'
                  ? t('careerServices.submitCheck')
                  : t('careerServices.submitRequest')
              }
              onCancel={() => setDialog(null)}
              onSubmit={(values, notes) =>
                requestMutation.mutate({ service: dialog.service, values, notes })
              }
            />
          )}

          {dialog.kind === 'respond' && (
            <ServiceRequestForm
              service={getCareerService(dialog.request.serviceCode)!}
              initialValues={dialog.request.candidateInput}
              myRequests={requests}
              prompt={dialog.request.adminMessage}
              isSubmitting={respondMutation.isPending}
              submitLabel={t('careerServices.submitInformation')}
              onCancel={() => setDialog(null)}
              onSubmit={(values, notes) =>
                respondMutation.mutate({ request: dialog.request, values, notes })
              }
            />
          )}

          {dialog.kind === 'detail' && (
            <RequestDetail
              request={dialog.request}
              service={getCareerService(dialog.request.serviceCode)!}
              canCancel={candidateCanCancel(dialog.request)}
              isCancelling={cancelMutation.isPending}
              onCancel={() => cancelMutation.mutate(dialog.request)}
              onClose={() => setDialog(null)}
            />
          )}
        </Modal>
      )}
    </div>
  )
}

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode
  onClose: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto px-4 py-8">
      <button
        type="button"
        aria-label="Close"
        className="fixed inset-0 bg-black/40"
        onClick={onClose}
      />
      <Card className="relative z-10 w-full max-w-2xl">
        <CardBody>
          <div className="mb-4 flex justify-end">
            <Button type="button" variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
          {children}
        </CardBody>
      </Card>
    </div>
  )
}
