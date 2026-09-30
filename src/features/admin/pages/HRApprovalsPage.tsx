import { useContext, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  Phone,
  ShieldCheck,
  Users,
  XCircle,
} from 'lucide-react'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Button } from '@/features/shared/components/ui/Button'
import { Badge } from '@/features/shared/components/ui/Badge'
import { EmptyState } from '@/features/shared/components/layout/EmptyState'
import { formatDate } from '@/lib/utils'
import { translateStatus } from '@/i18n/status'
import { LanguageContext } from '@/context/LanguageContext'
import { fetchPendingHrOrganizations, reviewHrOrganization } from '../actions'
import { adminQueryKeys, invalidateAdminWorkspace } from '../queryKeys'
import { notificationsQueryKeys } from '@/features/notifications/queryKeys'

type HRApprovalItem = {
  id: string
  name: string
  industry?: string | null
  website?: string | null
  createdAt: string
  status?: string | null
  contactName?: string | null
  contactPerson?: string | null
  contactEmail?: string | null
  email?: string | null
  phone?: string | null
  phoneNumber?: string | null
  location?: string | null
  city?: string | null
  country?: string | null
  candidatesCount?: number | null
  employeeCount?: number | null
  description?: string | null
  notes?: string | null
}

type ReviewPayload = {
  orgId: string
  approved: boolean
}

function safeText(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value
  if (typeof value === 'number') return String(value)
  return ''
}

function normalizeWebsite(website?: string | null) {
  if (!website) return ''
  const trimmed = website.trim()
  if (!trimmed) return ''
  return trimmed.startsWith('http') ? trimmed : `https://${trimmed}`
}

function getContactName(org: HRApprovalItem) {
  return safeText(org.contactName) || safeText(org.contactPerson)
}

function getContactEmail(org: HRApprovalItem) {
  return safeText(org.contactEmail) || safeText(org.email)
}

function getPhone(org: HRApprovalItem) {
  return safeText(org.phone) || safeText(org.phoneNumber)
}

function getLocation(org: HRApprovalItem) {
  const direct = safeText(org.location)
  if (direct) return direct

  const parts = [safeText(org.city), safeText(org.country)].filter(Boolean)
  return parts.length ? parts.join(', ') : ''
}

export function HRApprovalsPage() {
  const qc = useQueryClient()
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)
  const lang = language?.lang ?? 'en'

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [formError, setFormError] = useState<string | null>(null)
  const [reviewed, setReviewed] = useState<string | null>(null)

  const { data: orgs = [], refetch } = useQuery({
    queryKey: adminQueryKeys.hrPending,
    queryFn: fetchPendingHrOrganizations,
  })

  const typedOrgs = orgs as HRApprovalItem[]

  const selectedOrg = useMemo(() => {
    if (!typedOrgs.length) return null
    return typedOrgs.find((org) => org.id === selectedId) ?? typedOrgs[0]
  }, [typedOrgs, selectedId])

  const review = useMutation({
    mutationFn: async ({ orgId, approved }: ReviewPayload) => {
      return reviewHrOrganization(orgId, approved)
    },
    onSuccess: (_result, variables) => {
      void invalidateAdminWorkspace(qc)
      qc.invalidateQueries({ queryKey: notificationsQueryKeys.root })
      setReviewNotes('')
      setFormError(null)
      setReviewed(variables.approved ? 'approved' : 'rejected')
      setSelectedId(null)
      refetch()
    },
  })

  const handleReview = (approved: boolean) => {
    if (!selectedOrg || review.isPending) return

    if (!approved && !reviewNotes.trim()) {
      setFormError(t('hrApprovals.rejectReasonRequired'))
      return
    }
    setFormError(null)

    const message = approved
      ? t('hrApprovals.confirmApprove').replace('{name}', selectedOrg.name)
      : t('hrApprovals.confirmReject').replace('{name}', selectedOrg.name)

    if (!window.confirm(message)) return

    review.mutate({
      orgId: selectedOrg.id,
      approved,
    })
  }

  return (
    <div>
      <PageHeader
        title={t('hrApprovals.title')}
        description={t('hrApprovals.description')}
      />

      {typedOrgs.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={t('hrApprovals.emptyTitle')}
          description={t('hrApprovals.emptyDescription')}
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-[1fr_420px]">
          <Card>
            <CardBody className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold text-foreground">
                    {t('hrApprovals.requestsTitle')}
                  </h2>
                  <p className="text-sm text-muted">
                    {t('hrApprovals.requestsHint')}
                  </p>
                </div>

                <Badge variant="warning">{typedOrgs.length}</Badge>
              </div>

              <div className="overflow-hidden rounded-xl border border-border bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="border-b border-border bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 font-medium">{t('hrApprovals.organization')}</th>
                      <th className="hidden px-4 py-3 font-medium md:table-cell">
                        {t('hrApprovals.industry')}
                      </th>
                      <th className="hidden px-4 py-3 font-medium lg:table-cell">
                        {t('hrApprovals.contactOwner')}
                      </th>
                      <th className="px-4 py-3 font-medium">{t('hrApprovals.status')}</th>
                      <th className="px-4 py-3 font-medium">{t('hrApprovals.registered')}</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-border">
                    {typedOrgs.map((org) => {
                      const isSelected = selectedOrg?.id === org.id

                      return (
                        <tr
                          key={org.id}
                          className={
                            isSelected
                              ? 'cursor-pointer bg-primary-50/70'
                              : 'cursor-pointer hover:bg-slate-50'
                          }
                          onClick={() => setSelectedId(org.id)}
                        >
                          <td className="px-4 py-3">
                            <p className="font-semibold text-foreground">
                              {org.name}
                            </p>
                            {org.website && (
                              <p className="mt-1 text-xs text-muted">
                                {org.website}
                              </p>
                            )}
                          </td>

                          <td className="hidden px-4 py-3 text-muted md:table-cell">
                            {org.industry ?? t('hrApprovals.noIndustry')}
                          </td>

                          <td className="hidden px-4 py-3 lg:table-cell">
                            <p className="font-medium">
                              {getContactName(org) || t('common.notAvailable')}
                            </p>
                            <p className="text-xs text-muted">
                              {getContactEmail(org) || t('common.notAvailable')}
                            </p>
                          </td>

                          <td className="px-4 py-3">
                            <Badge variant="warning">
                              {translateStatus(org.status || 'pending', t)}
                            </Badge>
                          </td>

                          <td className="px-4 py-3 text-muted">
                            {formatDate(org.createdAt, lang)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>

          <Card>
            <CardBody className="space-y-4">
              <h2 className="font-semibold text-foreground">
                {t('hrApprovals.profileTitle')}
              </h2>

              {selectedOrg ? (
                <>
                  <div className="rounded-xl border border-border bg-slate-50 p-4 text-center">
                    <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-sm">
                      <Building2 className="h-6 w-6 text-muted" />
                    </div>

                    <p className="text-xs font-medium text-muted">
                      {t('hrApprovals.pendingOrg')}
                    </p>

                    <h3 className="mt-1 text-xl font-bold text-foreground">
                      {selectedOrg.name}
                    </h3>

                    <p className="mt-1 text-sm text-muted">
                      {selectedOrg.industry ?? t('hrApprovals.noIndustry')}
                    </p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <MetricCard
                      icon={<Users className="h-4 w-4" />}
                      label={t('hrApprovals.candidates')}
                      value={selectedOrg.candidatesCount ?? 0}
                    />
                    <MetricCard
                      icon={<ShieldCheck className="h-4 w-4" />}
                      label={t('hrApprovals.requestStatus')}
                      value={translateStatus(selectedOrg.status || 'pending', t)}
                    />
                  </div>

                  <div className="rounded-xl border border-border p-4">
                    <h3 className="mb-3 font-semibold text-foreground">
                      {t('hrApprovals.organizationInfo')}
                    </h3>

                    <div className="space-y-3 text-sm">
                      <InfoRow
                        icon={<Building2 className="h-4 w-4" />}
                        label={t('hrApprovals.organizationName')}
                        value={selectedOrg.name}
                      />
                      <InfoRow
                        icon={<Users className="h-4 w-4" />}
                        label={t('hrApprovals.contactOwner')}
                        value={getContactName(selectedOrg) || t('common.notAvailable')}
                      />
                      <InfoRow
                        icon={<Mail className="h-4 w-4" />}
                        label={t('hrApprovals.email')}
                        value={getContactEmail(selectedOrg) || t('common.notAvailable')}
                      />
                      <InfoRow
                        icon={<Phone className="h-4 w-4" />}
                        label={t('hrApprovals.phone')}
                        value={getPhone(selectedOrg) || t('common.notAvailable')}
                      />
                      <InfoRow
                        icon={<MapPin className="h-4 w-4" />}
                        label={t('hrApprovals.location')}
                        value={getLocation(selectedOrg) || t('common.notAvailable')}
                      />
                      <InfoRow
                        icon={<Building2 className="h-4 w-4" />}
                        label={t('hrApprovals.employeeCount')}
                        value={selectedOrg.employeeCount ?? t('common.notAvailable')}
                      />
                      <InfoRow
                        icon={<ShieldCheck className="h-4 w-4" />}
                        label={t('hrApprovals.registered')}
                        value={formatDate(selectedOrg.createdAt, lang)}
                      />
                    </div>
                  </div>

                  <div className="rounded-xl border border-border p-4">
                    <h3 className="mb-2 font-semibold text-foreground">
                      {t('hrApprovals.organizationBio')}
                    </h3>
                    <p className="text-sm leading-6 text-muted">
                      {selectedOrg.description ||
                        selectedOrg.notes ||
                        t('hrApprovals.noBio')}
                    </p>
                  </div>

                  <div className="rounded-xl border border-border p-4">
                    <h3 className="mb-3 font-semibold text-foreground">
                      {t('hrApprovals.website')}
                    </h3>

                    {selectedOrg.website ? (
                      <a
                        href={normalizeWebsite(selectedOrg.website)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-sm text-primary hover:bg-slate-50"
                      >
                        <span className="flex items-center gap-2">
                          <Globe className="h-4 w-4" />
                          {selectedOrg.website}
                        </span>
                        <ExternalLink className="h-4 w-4" />
                      </a>
                    ) : (
                      <p className="text-sm text-muted">
                        {t('hrApprovals.noWebsite')}
                      </p>
                    )}
                  </div>

                  <textarea
                    className="min-h-[90px] w-full rounded-lg border border-border px-3 py-2 text-sm"
                    placeholder={t('hrApprovals.notesPlaceholder')}
                    value={reviewNotes}
                    onChange={(event) => setReviewNotes(event.target.value)}
                  />

                  {(formError || review.isError) && (
                    <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                      <span>
                        {formError ??
                          (review.error instanceof Error
                            ? review.error.message
                            : t('hrApprovals.saveFailed'))}
                      </span>
                    </div>
                  )}

                  <div>
                    <p className="mb-2 text-sm font-medium text-foreground">
                      {t('verificationQueue.actionArea')}
                    </p>

                    <div className="flex gap-2">
                      <Button
                        variant="danger"
                        className="flex-1"
                        isLoading={review.isPending}
                        onClick={() => handleReview(false)}
                      >
                        <span className="inline-flex items-center gap-2">
                          <XCircle className="h-4 w-4" />
                          {t('hrApprovals.reject')}
                        </span>
                      </Button>

                      <Button
                        className="flex-1"
                        isLoading={review.isPending}
                        onClick={() => handleReview(true)}
                      >
                        <span className="inline-flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4" />
                          {t('hrApprovals.approve')}
                        </span>
                      </Button>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted">
                  {reviewed === 'approved'
                    ? `${t('hrApprovals.approvedMessage')} `
                    : reviewed === 'rejected'
                      ? `${t('hrApprovals.rejectedMessage')} `
                      : ''}
                  {t('hrApprovals.selectHint')}
                </p>
              )}
            </CardBody>
          </Card>
        </div>
      )}
    </div>
  )
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border pb-2 last:border-b-0 last:pb-0">
      <span className="flex items-center gap-2 text-muted">
        {icon}
        {label}
      </span>
      <span className="text-right font-medium text-foreground">{value}</span>
    </div>
  )
}

function MetricCard({
  icon,
  label,
  value,
}: {
  icon: ReactNode
  label: string
  value: ReactNode
}) {
  return (
    <div className="rounded-xl border border-border bg-white p-4">
      <div className="flex items-center gap-2 text-muted">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="mt-2 text-lg font-semibold text-foreground">{value}</p>
    </div>
  )
}
