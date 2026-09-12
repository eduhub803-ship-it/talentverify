import { useContext, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Briefcase, Check, ShieldCheck } from 'lucide-react'
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
  CareerServiceRequestStatus,
  CareerServiceResult,
  EmployerPlan,
  EmployerServiceRequest,
  HrOrganization,
} from '@/types/domain'
import {
  CAREER_REQUEST_STATUSES,
  STATUS_LABELS,
  STATUS_LABELS_AR,
  staffActionsFor,
} from '@/features/career-services/rules'
import {
  applyEmployerStaffTransition,
  fetchEmployerServiceQueue,
  setEmployerPlan,
} from '@/features/employer/actions'
import { TalentShortlistBuilder } from '@/features/employer/components/TalentShortlistBuilder'
import { PartnershipPanel } from '@/features/employer/components/PartnershipPanel'
import { EMPLOYER_PLANS, partnershipStatusOf } from '@/features/employer/plans'
import { employerQueryKeys } from '@/features/employer/queryKeys'
import { getEmployerService } from '@/features/employer/catalog'
import { fetchHrOrganizations } from '../actions'
import { adminQueryKeys } from '../queryKeys'

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

/** Services 31-36 from the SEH side: employer plans plus the 35/36 queue. */
export function EmployerServicesQueuePage() {
  const actor = useAuthStore((state) => state.profile)
  const qc = useQueryClient()
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)
  const isArabic = language?.lang === 'ar'

  const [statusFilter, setStatusFilter] = useState('open')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [scheduledAt, setScheduledAt] = useState('')
  const [adminMessage, setAdminMessage] = useState('')
  const [internalNotes, setInternalNotes] = useState('')
  const [resultSummary, setResultSummary] = useState('')
  const [recommendations, setRecommendations] = useState('')
  const [deliverableUrl, setDeliverableUrl] = useState('')
  const [feedback, setFeedback] = useState<string | null>(null)
  const [planFeedback, setPlanFeedback] = useState<string | null>(null)
  const [managedOrgId, setManagedOrgId] = useState<string | null>(null)

  const statusLabel = (status: CareerServiceRequestStatus) =>
    isArabic ? STATUS_LABELS_AR[status] : STATUS_LABELS[status]

  const { data: requests = [], error: queueError } = useQuery({
    queryKey: employerQueryKeys.queue,
    queryFn: () => fetchEmployerServiceQueue(actor),
  })

  const { data: organizations = [] } = useQuery({
    queryKey: adminQueryKeys.organizations,
    queryFn: fetchHrOrganizations,
  })

  const filtered = useMemo(
    () =>
      requests.filter((request) => {
        if (statusFilter === 'open') {
          return !['completed', 'cancelled'].includes(request.status)
        }
        if (statusFilter && request.status !== statusFilter) return false
        return true
      }),
    [requests, statusFilter],
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
      request: EmployerServiceRequest
      status: CareerServiceRequestStatus
    }) => {
      const result: CareerServiceResult | null =
        status === 'completed'
          ? {
              summary: resultSummary.trim(),
              recommendations: toLines(recommendations),
              deliverableUrl: deliverableUrl.trim() || null,
              deliverableName: deliverableUrl.trim() ? 'Deliverable' : null,
            }
          : null

      return applyEmployerStaffTransition({
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
      qc.invalidateQueries({ queryKey: employerQueryKeys.root })
      qc.invalidateQueries({ queryKey: notificationsQueryKeys.root })
      setFeedback(`${t('careerAdmin.updatedTo')} ${statusLabel(updated.status)}.`)
      setAdminMessage('')
      setInternalNotes('')
      setResultSummary('')
      setRecommendations('')
      setDeliverableUrl('')
      setScheduledAt('')
    },
  })

  const changePlan = useMutation({
    mutationFn: ({
      organization,
      plan,
    }: {
      organization: HrOrganization
      plan: EmployerPlan
    }) => setEmployerPlan({ actor, organizationId: organization.id, plan }),
    onSuccess: (organization) => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.organizations })
      qc.invalidateQueries({ queryKey: employerQueryKeys.root })
      qc.invalidateQueries({ queryKey: notificationsQueryKeys.root })
      setPlanFeedback(
        `${organization.name}: ${t(`employer.plan.${organization.plan ?? 'free'}`)}`,
      )
    },
  })

  const selectedService = selected ? getEmployerService(selected.serviceCode) : undefined
  const actions =
    selected && selectedService ? staffActionsFor(selected, selectedService) : []

  if (queueError) {
    return (
      <div>
        <PageHeader title={t('employerAdmin.title')} />
        <EmptyState
          icon={Briefcase}
          title={t('employerAdmin.unavailableTitle')}
          description={
            queueError instanceof Error
              ? queueError.message
              : t('employerAdmin.unavailableDescription')
          }
        />
      </div>
    )
  }

  return (
    <div>
      <PageHeader
        title={t('employerAdmin.title')}
        description={t('employerAdmin.description')}
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Card>
            <CardBody className="space-y-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[180px] flex-1">
                  <label className="mb-1 block text-xs font-medium text-muted">
                    {t('careerAdmin.filterStatus')}
                  </label>
                  <select
                    className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm"
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                  >
                    <option value="open">{t('careerAdmin.openRequests')}</option>
                    <option value="">{t('careerAdmin.allStatuses')}</option>
                    {CAREER_REQUEST_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </select>
                </div>
                <Badge variant="primary">{filtered.length}</Badge>
              </div>

              {filtered.length === 0 ? (
                <EmptyState
                  icon={Briefcase}
                  title={t('employerAdmin.emptyTitle')}
                  description={t('employerAdmin.emptyDescription')}
                />
              ) : (
                <div className="overflow-x-auto rounded-xl border border-border bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="border-b border-border bg-slate-50">
                      <tr>
                        <th className="px-4 py-3 font-medium">
                          {t('employerAdmin.organization')}
                        </th>
                        <th className="px-4 py-3 font-medium">{t('careerAdmin.service')}</th>
                        <th className="px-4 py-3 font-medium">{t('careerAdmin.status')}</th>
                        <th className="hidden px-4 py-3 font-medium md:table-cell">
                          {t('careerAdmin.submitted')}
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {filtered.map((request) => {
                        const service = getEmployerService(request.serviceCode)
                        return (
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
                                {request.organizationName}
                              </p>
                              <p className="break-all text-xs text-muted">
                                {request.requestedByName}
                              </p>
                            </td>
                            <td className="px-4 py-3">
                              {isArabic ? service?.nameAr : service?.name}
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
                            </td>
                            <td className="hidden px-4 py-3 text-muted md:table-cell">
                              {formatDate(request.submittedAt)}
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="font-semibold text-foreground">
                {t('employerAdmin.plansTitle')}
              </h2>
            </CardHeader>
            <CardBody className="space-y-3">
              <p className="text-sm text-muted">{t('employerAdmin.plansDescription')}</p>

              {planFeedback && (
                <p className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-success">
                  <Check className="h-4 w-4" />
                  {planFeedback}
                </p>
              )}
              {changePlan.isError && (
                <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>
                    {changePlan.error instanceof Error
                      ? changePlan.error.message
                      : t('employerAdmin.planFailed')}
                  </span>
                </div>
              )}

              {organizations.length === 0 ? (
                <p className="text-sm text-muted">{t('employerAdmin.noOrganizations')}</p>
              ) : (
                <div className="space-y-2">
                  {organizations.map((organization) => (
                    <div
                      key={organization.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
                    >
                      <div className="min-w-0">
                        <p className="flex flex-wrap items-center gap-2 font-medium text-foreground">
                          {organization.name}
                          {organization.status === 'approved' && (
                            <span className="inline-flex items-center gap-1 text-xs text-success">
                              <ShieldCheck className="h-3.5 w-3.5" />
                              {t('employer.profile.verified')}
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-muted">
                          {organization.industry ?? '—'}
                          {organization.profileSubmittedAt
                            ? ` · ${t('employer.profile.lastSubmitted')} ${formatDate(organization.profileSubmittedAt)}`
                            : ''}
                        </p>
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        <Badge
                          variant={
                            organization.plan === 'partner'
                              ? 'success'
                              : organization.plan === 'pro'
                                ? 'primary'
                                : 'default'
                          }
                        >
                          {t(`employer.plan.${organization.plan ?? 'free'}`)}
                        </Badge>
                        {organization.plan === 'partner' && (
                          <Badge variant="default">
                            {t(
                              `employer.partnership.status.${
                                partnershipStatusOf(organization) ?? 'pending'
                              }`,
                            )}
                          </Badge>
                        )}
                        <select
                          className="h-9 rounded-lg border border-border bg-white px-2 text-sm"
                          value={organization.plan ?? 'free'}
                          disabled={changePlan.isPending}
                          onChange={(event) =>
                            changePlan.mutate({
                              organization,
                              plan: event.target.value as EmployerPlan,
                            })
                          }
                        >
                          {EMPLOYER_PLANS.map((plan) => (
                            <option key={plan} value={plan}>
                              {t(`employer.plan.${plan}`)}
                            </option>
                          ))}
                        </select>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            setManagedOrgId(
                              managedOrgId === organization.id ? null : organization.id,
                            )
                          }
                        >
                          {managedOrgId === organization.id
                            ? t('employerAdmin.hideDetails')
                            : t('employerAdmin.manage')}
                        </Button>
                      </div>

                      {managedOrgId === organization.id && (
                        <div className="w-full">
                          <PartnershipPanel organization={organization} />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardBody>
          </Card>
        </div>

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
                    {selected.organizationName}
                  </h3>
                  <p className="text-sm text-muted">{selected.requestedByName}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Badge variant={statusVariant(selected.status)}>
                      {statusLabel(selected.status)}
                    </Badge>
                    <Badge
                      variant={selected.paymentStatus === 'received' ? 'success' : 'warning'}
                    >
                      {t(`careerServices.paymentStatus.${selected.paymentStatus}`)}
                    </Badge>
                  </div>
                </div>

                <div className="rounded-xl border border-border p-4">
                  <h4 className="mb-2 text-sm font-semibold text-foreground">
                    {t('employerAdmin.employerInput')}
                  </h4>
                  <dl className="space-y-2 text-sm">
                    {selectedService.inputFields
                      .filter((field) => selected.input[field.key])
                      .map((field) => (
                        <div key={field.key}>
                          <dt className="text-xs text-muted">
                            {isArabic ? field.labelAr : field.label}
                          </dt>
                          <dd className="whitespace-pre-line break-words text-foreground">
                            {selected.input[field.key]}
                          </dd>
                        </div>
                      ))}
                  </dl>
                  {selected.notes && (
                    <p className="mt-3 whitespace-pre-line break-words text-sm text-muted">
                      {selected.notes}
                    </p>
                  )}
                </div>

                {selected.internalNotes && (
                  <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                    <p className="text-xs font-medium">{t('careerAdmin.internalNotes')}</p>
                    <p className="mt-1 whitespace-pre-line break-words">
                      {selected.internalNotes}
                    </p>
                  </div>
                )}

                {selected.serviceCode === '34' && (
                  <TalentShortlistBuilder request={selected} />
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
                    {t('employerAdmin.messageToEmployer')}
                  </label>
                  <textarea
                    className="min-h-[70px] w-full rounded-lg border border-border px-3 py-2 text-sm"
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
