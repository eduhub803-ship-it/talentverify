import { useContext, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Briefcase, Check, User } from 'lucide-react'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Card, CardBody, CardHeader } from '@/features/shared/components/ui/Card'
import { Button } from '@/features/shared/components/ui/Button'
import { Badge } from '@/features/shared/components/ui/Badge'
import { Input } from '@/features/shared/components/ui/Input'
import { EmptyState } from '@/features/shared/components/layout/EmptyState'
import { LanguageContext } from '@/context/LanguageContext'
import { useAuthStore } from '@/stores/auth-store'
import { formatDate } from '@/lib/utils'
import { notificationsQueryKeys } from '@/features/notifications/queryKeys'
import type {
  CareerServiceRequest,
  CareerServiceRequestStatus,
  CareerServiceResult,
} from '@/types/domain'
import {
  applyCareerStaffTransition,
  fetchCareerServiceQueue,
} from '@/features/career-services/actions'
import { careerServicesQueryKeys } from '@/features/career-services/queryKeys'
import {
  ACTIVE_CAREER_SERVICES,
  CAREER_SERVICE_CATEGORIES,
  getCareerService,
} from '@/features/career-services/catalog'
import {
  CAREER_REQUEST_STATUSES,
  STATUS_LABELS,
  STATUS_LABELS_AR,
  staffActionsFor,
} from '@/features/career-services/rules'

/** One item per line, blank lines ignored. */
function toLines(value: string): string[] {
  return value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
}

function statusVariant(status: CareerServiceRequestStatus) {
  if (status === 'completed') return 'success' as const
  if (status === 'cancelled') return 'danger' as const
  if (status === 'waiting_candidate' || status === 'payment_pending') return 'warning' as const
  return 'default' as const
}

export function CareerServicesQueuePage() {
  const actor = useAuthStore((state) => state.profile)
  const qc = useQueryClient()
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)
  const isArabic = language?.lang === 'ar'
  const statusLabel = (status: CareerServiceRequestStatus) =>
    isArabic ? STATUS_LABELS_AR[status] : STATUS_LABELS[status]
  const serviceLabel = (code: string) => {
    const service = getCareerService(code)
    if (!service) return code
    return isArabic ? service.nameAr : service.name
  }

  const [statusFilter, setStatusFilter] = useState<string>('open')
  const [serviceFilter, setServiceFilter] = useState<string>('')
  const [categoryFilter, setCategoryFilter] = useState<string>('')
  const [search, setSearch] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scheduledAt, setScheduledAt] = useState('')
  const [adminMessage, setAdminMessage] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [resultSummary, setResultSummary] = useState('')
  const [deliverableUrl, setDeliverableUrl] = useState('')
  const [recommendations, setRecommendations] = useState('')
  const [strengths, setStrengths] = useState('')
  const [gaps, setGaps] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)

  const { data: requests = [], error: queueError } = useQuery({
    queryKey: careerServicesQueryKeys.queue,
    queryFn: () => fetchCareerServiceQueue(actor),
  })

  const filtered = useMemo(
    () =>
      requests.filter((request) => {
        if (serviceFilter && request.serviceCode !== serviceFilter) return false
        if (
          categoryFilter &&
          getCareerService(request.serviceCode)?.category !== categoryFilter
        ) {
          return false
        }
        if (statusFilter === 'open') {
          if (['completed', 'cancelled'].includes(request.status)) return false
        } else if (statusFilter === 'needs_action') {
          // Everything sitting on the career team right now.
          if (!['payment_pending', 'ready', 'assigned', 'in_progress'].includes(request.status)) {
            return false
          }
        } else if (statusFilter && request.status !== statusFilter) {
          return false
        }

        const query = search.trim().toLowerCase()
        if (!query) return true
        return (
          (request.candidateName ?? '').toLowerCase().includes(query) ||
          (request.candidateEmail ?? '').toLowerCase().includes(query) ||
          serviceLabel(request.serviceCode).toLowerCase().includes(query)
        )
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [requests, serviceFilter, categoryFilter, statusFilter, search, isArabic],
  )

  const selected = useMemo(
    () => requests.find((request) => request.id === selectedId) ?? null,
    [requests, selectedId],
  )

  const transition = useMutation({
    mutationFn: ({
      request,
      status,
    }: {
      request: CareerServiceRequest
      status: CareerServiceRequestStatus
    }) => {
      const result: CareerServiceResult | null =
        status === 'completed'
          ? {
              summary: resultSummary.trim(),
              strengths: toLines(strengths),
              gaps: toLines(gaps),
              recommendations: toLines(recommendations),
              deliverableUrl: deliverableUrl.trim() || null,
              deliverableName: deliverableUrl.trim() ? 'Deliverable' : null,
            }
          : null

      return applyCareerStaffTransition({
        actor,
        requestId: request.id,
        status,
        scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : null,
        result,
        adminMessage: adminMessage.trim() || null,
        internalNotes: internalNotes.trim() || null,
      })
    },
    onSuccess: (updated) => {
      qc.invalidateQueries({ queryKey: careerServicesQueryKeys.root })
      qc.invalidateQueries({ queryKey: notificationsQueryKeys.root })
      setFeedback(
        `${t('careerAdmin.updatedTo')} ${
          isArabic ? STATUS_LABELS_AR[updated.status] : STATUS_LABELS[updated.status]
        }.`,
      )
      setAdminMessage('')
      setInternalNotes('')
      setResultSummary('')
      setDeliverableUrl('')
      setRecommendations('')
      setStrengths('')
      setGaps('')
      setScheduledAt('')
    },
  })

  const selectedService = selected ? getCareerService(selected.serviceCode) : undefined
  const actions = selected && selectedService ? staffActionsFor(selected, selectedService) : []

  if (queueError) {
    return (
      <div>
        <PageHeader title={t('careerAdmin.title')} />
        <EmptyState
          icon={Briefcase}
          title={t('careerAdmin.unavailableTitle')}
          description={
            queueError instanceof Error
              ? queueError.message
              : t('careerAdmin.unavailableDescription')
          }
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={t('careerAdmin.title')}
        description={t('careerAdmin.description')}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <Card>
          <CardBody className="space-y-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[160px] flex-1">
                <label className="mb-1 block text-xs font-medium text-muted">
                  {t('careerAdmin.filterStatus')}
                </label>
                <select
                  className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm"
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="open">{t('careerAdmin.openRequests')}</option>
                  <option value="needs_action">{t('careerAdmin.needsAction')}</option>
                  <option value="">{t('careerAdmin.allStatuses')}</option>
                  {CAREER_REQUEST_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {statusLabel(status)}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[180px] flex-1">
                <label className="mb-1 block text-xs font-medium text-muted">
                  {t('careerAdmin.filterService')}
                </label>
                <select
                  className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm"
                  value={serviceFilter}
                  onChange={(event) => setServiceFilter(event.target.value)}
                >
                  <option value="">{t('careerAdmin.allServices')}</option>
                  {ACTIVE_CAREER_SERVICES.filter(
                    (service) => !categoryFilter || service.category === categoryFilter,
                  ).map((service) => (
                    <option key={service.code} value={service.code}>
                      {isArabic ? service.nameAr : service.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[160px] flex-1">
                <label className="mb-1 block text-xs font-medium text-muted">
                  {t('careerAdmin.filterCategory')}
                </label>
                <select
                  className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm"
                  value={categoryFilter}
                  onChange={(event) => {
                    setCategoryFilter(event.target.value)
                    setServiceFilter('')
                  }}
                >
                  <option value="">{t('careerAdmin.allCategories')}</option>
                  {CAREER_SERVICE_CATEGORIES.map((category) => (
                    <option key={category.key} value={category.key}>
                      {isArabic ? category.labelAr : category.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="min-w-[180px] flex-1">
                <Input
                  name="career-queue-search"
                  label={t('careerAdmin.search')}
                  placeholder={t('careerAdmin.searchPlaceholder')}
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </div>

              <Badge variant="primary">{filtered.length}</Badge>
            </div>

            {filtered.length === 0 ? (
              <EmptyState
                icon={Briefcase}
                title={t('careerAdmin.emptyTitle')}
                description={t('careerAdmin.emptyDescription')}
              />
            ) : (
              <div className="overflow-x-auto rounded-xl border border-border bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 font-medium">{t('careerAdmin.candidate')}</th>
                      <th className="px-4 py-3 font-medium">{t('careerAdmin.service')}</th>
                      <th className="px-4 py-3 font-medium">{t('careerAdmin.status')}</th>
                      <th className="hidden px-4 py-3 font-medium md:table-cell">
                        {t('careerAdmin.submitted')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((request) => (
                      <tr
                        key={request.id}
                        className={
                          selectedId === request.id
                            ? 'cursor-pointer bg-primary-50/70'
                            : 'cursor-pointer hover:bg-slate-50'
                        }
                        onClick={() => {
                          setFeedback(null)
                          setSelectedId(request.id)
                        }}
                      >
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">
                            {request.candidateName}
                          </p>
                          <p className="break-all text-xs text-muted">{request.candidateEmail}</p>
                        </td>
                        <td className="px-4 py-3">
                          {serviceLabel(request.serviceCode)}
                          {request.paymentStatus === 'pending' && (
                            <Badge variant="warning" className="ms-2">
                              {t('careerAdmin.unpaid')}
                            </Badge>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <Badge variant={statusVariant(request.status)}>
                            {statusLabel(request.status)}
                          </Badge>
                          {request.status === 'waiting_candidate' && (
                            <p className="mt-1 text-xs text-muted">
                              {t('careerAdmin.withCandidate')}
                            </p>
                          )}
                          {request.scheduledAt && request.status === 'scheduled' && (
                            <p className="mt-1 text-xs text-muted">
                              {formatDate(request.scheduledAt)}
                            </p>
                          )}
                        </td>
                        <td className="hidden px-4 py-3 text-muted md:table-cell">
                          {formatDate(request.submittedAt)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="font-semibold text-foreground">
              {selected ? t('careerAdmin.manageRequest') : t('careerAdmin.selectRequest')}
            </h2>
          </CardHeader>
          <CardBody className="space-y-4">
            {!selected || !selectedService ? (
              <div className="space-y-2">
                {feedback && (
                  <p className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-success">
                    <Check className="h-4 w-4" />
                    {feedback}
                  </p>
                )}
                <p className="text-sm text-muted">{t('careerAdmin.selectRequestHint')}</p>
              </div>
            ) : (
              <>
                <div className="rounded-xl border border-border bg-slate-50 p-4">
                  <p className="text-xs text-muted">
                    {isArabic ? selectedService.nameAr : selectedService.name}
                  </p>
                  <h3 className="mt-1 text-lg font-semibold text-foreground">
                    {selected.candidateName}
                  </h3>
                  <p className="text-sm text-muted">{selected.candidateEmail}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant={statusVariant(selected.status)}>
                      {statusLabel(selected.status)}
                    </Badge>
                    <Badge
                      variant={selected.paymentStatus === 'received' ? 'success' : 'warning'}
                    >
                      {t(`careerServices.paymentStatus.${selected.paymentStatus}`)}
                    </Badge>
                    {selected.assignedToName && (
                      <Badge>
                        {t('careerAdmin.assignedTo')} {selected.assignedToName}
                      </Badge>
                    )}
                  </div>
                  <Link
                    to={`/hr/candidate/${selected.candidateId}`}
                    className="mt-3 inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <User className="h-4 w-4" />
                    {t('careerAdmin.viewCandidate')}
                  </Link>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <h4 className="mb-2 text-sm font-semibold text-foreground">
                    {t('careerAdmin.candidateInput')}
                  </h4>
                  <dl className="space-y-2 text-sm">
                    {selectedService.inputFields
                      .filter((field) => selected.candidateInput[field.key])
                      .map((field) => (
                        <div key={field.key}>
                          <dt className="text-xs text-muted">
                            {isArabic ? field.labelAr : field.label}
                          </dt>
                          <dd className="whitespace-pre-line break-words text-foreground">
                            {selected.candidateInput[field.key]}
                          </dd>
                        </div>
                      ))}
                  </dl>
                  {selected.candidateNotes && (
                    <p className="mt-3 whitespace-pre-line break-words text-sm text-muted">
                      {selected.candidateNotes}
                    </p>
                  )}
                </div>

                {selected.internalNotes && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="text-xs font-medium">{t('careerAdmin.internalNotes')}</p>
                    <p className="mt-1 whitespace-pre-line break-words">{selected.internalNotes}</p>
                  </div>
                )}

                {selectedService.requiresScheduling && (
                  <Input
                    type="datetime-local"
                    label={t('careerAdmin.scheduleAt')}
                    value={scheduledAt}
                    onChange={(event) => setScheduledAt(event.target.value)}
                  />
                )}

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-foreground">
                    {t('careerAdmin.messageToCandidate')}
                  </label>
                  <textarea
                    className="min-h-[70px] w-full rounded-lg border border-border px-3 py-2 text-sm"
                    placeholder={t('careerAdmin.messagePlaceholder')}
                    value={adminMessage}
                    onChange={(event) => setAdminMessage(event.target.value)}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-foreground">
                    {t('careerAdmin.internalNotes')}
                  </label>
                  <textarea
                    className="min-h-[60px] w-full rounded-lg border border-border px-3 py-2 text-sm"
                    placeholder={t('careerAdmin.internalNotesPlaceholder')}
                    value={internalNotes}
                    onChange={(event) => setInternalNotes(event.target.value)}
                  />
                </div>

                <div className="space-y-3 rounded-xl border border-border p-4">
                  <h4 className="text-sm font-semibold text-foreground">
                    {t('careerAdmin.result')}
                  </h4>
                  <Input
                    label={t('careerAdmin.resultSummary')}
                    value={resultSummary}
                    onChange={(event) => setResultSummary(event.target.value)}
                  />
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-foreground">
                      {t('careerAdmin.resultStrengths')}
                    </label>
                    <textarea
                      className="min-h-[60px] w-full rounded-lg border border-border px-3 py-2 text-sm"
                      placeholder={t('careerAdmin.onePerLine')}
                      value={strengths}
                      onChange={(event) => setStrengths(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-foreground">
                      {t('careerAdmin.resultGaps')}
                    </label>
                    <textarea
                      className="min-h-[60px] w-full rounded-lg border border-border px-3 py-2 text-sm"
                      placeholder={t('careerAdmin.onePerLine')}
                      value={gaps}
                      onChange={(event) => setGaps(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="block text-sm font-medium text-foreground">
                      {t('careerAdmin.resultRecommendations')}
                    </label>
                    <textarea
                      className="min-h-[70px] w-full rounded-lg border border-border px-3 py-2 text-sm"
                      placeholder={t('careerAdmin.onePerLine')}
                      value={recommendations}
                      onChange={(event) => setRecommendations(event.target.value)}
                    />
                  </div>
                  <Input
                    label={t('careerAdmin.deliverableUrl')}
                    placeholder="https://"
                    value={deliverableUrl}
                    onChange={(event) => setDeliverableUrl(event.target.value)}
                  />
                </div>

                {transition.isError && (
                  <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>
                      {transition.error instanceof Error
                        ? transition.error.message
                        : t('careerAdmin.updateFailed')}
                    </span>
                  </div>
                )}

                {feedback && !transition.isError && (
                  <p className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-success">
                    <Check className="h-4 w-4" />
                    {feedback}
                  </p>
                )}

                <div>
                  <p className="mb-2 text-sm font-medium text-foreground">
                    {t('careerAdmin.availableActions')}
                  </p>
                  {actions.length === 0 ? (
                    <p className="text-sm text-muted">{t('careerAdmin.noActions')}</p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {actions.map((action) => (
                        <Button
                          key={action.status}
                          size="sm"
                          variant={action.variant}
                          isLoading={
                            transition.isPending &&
                            transition.variables?.status === action.status
                          }
                          disabled={transition.isPending}
                          onClick={() =>
                            transition.mutate({ request: selected, status: action.status })
                          }
                        >
                          {isArabic ? action.labelAr : action.label}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}
