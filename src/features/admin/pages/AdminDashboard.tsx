import { useContext, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  Activity,
  ArrowRight,
  Building2,
  ClipboardList,
  MessageSquare,
  Users,
} from 'lucide-react'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Button } from '@/features/shared/components/ui/Button'
import { LanguageContext } from '@/context/LanguageContext'
import {
  fetchAdminStats,
  fetchPendingHrOrganizations,
  fetchVerificationQueue,
} from '../actions'
import { adminQueryKeys } from '../queryKeys'
import { formatDate } from '@/lib/utils'
import type { HrOrganization, VerificationQueueItem } from '@/types/domain'

type SafeRecord = Record<string, unknown>
type SafeQueueItem = VerificationQueueItem & SafeRecord
type SafeOrgItem = HrOrganization & SafeRecord




export function AdminDashboard() {
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

  const { data: stats } = useQuery({
    queryKey: adminQueryKeys.dashboard,
    queryFn: () => fetchAdminStats(),
  })

  const { data: verificationQueue = [] } = useQuery({
    queryKey: adminQueryKeys.verificationQueue,
    queryFn: fetchVerificationQueue,
  })

  const { data: pendingHrOrganizations = [] } = useQuery({
    queryKey: adminQueryKeys.hrPending,
    queryFn: fetchPendingHrOrganizations,
  })

  const safeQueue = verificationQueue as SafeQueueItem[]
  const safeOrgs = pendingHrOrganizations as SafeOrgItem[]

  const reviewQueueRows = useMemo(
    () => [
      ...safeQueue.slice(0, 5).map((candidate) => ({
        key: `candidate-${candidate.userId}`,
        name: candidate.fullName,
        type: t('adminDashboard.typeCandidate'),
        status: candidate.verificationStatus,
        lastActivity: candidate.updatedAt,
        requiredAction:
          candidate.documentCount > 0
            ? t('adminDashboard.reviewCandidate')
            : t('adminDashboard.waitingForDocuments'),
        to: '/admin/verification-queue',
      })),
      ...safeOrgs.slice(0, 5).map((org) => ({
        key: `org-${org.id}`,
        name: org.name,
        type: t('adminDashboard.typeOrganization'),
        status: org.status,
        lastActivity: org.createdAt,
        requiredAction: t('adminDashboard.reviewOrganization'),
        to: '/admin/hr-approvals',
      })),
    ],
    [safeOrgs, safeQueue, t],
  )

  const recentActivity = useMemo(
    () =>
      [
        ...safeQueue.map((candidate) => ({
          key: `candidate-activity-${candidate.userId}`,
          label: t('adminDashboard.candidateSubmitted'),
          subject: candidate.fullName,
          date: candidate.updatedAt,
        })),
        ...safeOrgs.map((org) => ({
          key: `org-activity-${org.id}`,
          label: t('adminDashboard.hrRegistered'),
          subject: org.name,
          date: org.createdAt,
        })),
      ]
        .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
        .slice(0, 6),
    [safeOrgs, safeQueue, t],
  )

  const followUps = useMemo(
    () => [
      ...safeQueue
        .filter((candidate) => candidate.documentCount === 0)
        .map((candidate) => ({
          key: `candidate-follow-up-${candidate.userId}`,
          title: candidate.fullName,
          detail: t('adminDashboard.missingDocuments'),
          to: '/admin/verification-queue',
        })),
      ...safeOrgs.map((org) => ({
        key: `org-follow-up-${org.id}`,
        title: org.name,
        detail: t('adminDashboard.pendingHrApproval'),
        to: '/admin/hr-approvals',
      })),
    ],
    [safeOrgs, safeQueue, t],
  )

  const cards: {
    label: string
    value: number
    icon: typeof ClipboardList
    to?: string
  }[] = [
    {
      label: 'Pending verifications',
      value: stats?.pendingVerifications ?? 0,
      icon: ClipboardList,
      to: '/admin/verification-queue',
    },
    {
      label: 'Pending HR orgs',
      value: stats?.pendingHrOrgs ?? 0,
      icon: Building2,
      to: '/admin/hr-approvals',
    },
    {
      label: 'Verified candidates',
      value: stats?.verifiedCandidates ?? 0,
      icon: Users,
    },
    {
      label: 'Total candidates',
      value: stats?.totalCandidates ?? 0,
      icon: Users,
    },
  ]

  return (
    <div>
      <PageHeader
        title={t('adminDashboard.title')}
        description={t('adminDashboard.description')}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Card key={card.label}>
            <CardBody>
              <div className="flex items-center justify-between">
                <p className="text-sm text-muted">{t(card.label)}</p>
                <card.icon className="h-5 w-5 text-muted" />
              </div>
              <p className="mt-2 text-3xl font-semibold">{card.value}</p>
              {card.to && (
                <Link to={card.to} className="mt-4 inline-block">
                  <Button variant="ghost" size="sm">
                    {t('adminDashboard.manage')}
                  </Button>
                </Link>
              )}
            </CardBody>
          </Card>
        ))}
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card>
          <CardBody>
            <div className="mb-5 flex items-center gap-2">
              <ClipboardList className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-foreground">
                {t('adminDashboard.workQueueTitle')}
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <QueueMetric
                label={t('adminDashboard.pendingCandidateRequests')}
                value={stats?.pendingVerifications ?? verificationQueue.length}
                to="/admin/verification-queue"
              />
              <QueueMetric
                label={t('adminDashboard.pendingHrApprovals')}
                value={stats?.pendingHrOrgs ?? pendingHrOrganizations.length}
                to="/admin/hr-approvals"
              />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <div className="mb-5 flex items-center gap-2">
              <ArrowRight className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-foreground">
                {t('adminDashboard.quickActionsTitle')}
              </h2>
            </div>
            <div className="space-y-3">
              <QuickAction
                label={t('adminDashboard.openVerificationQueue')}
                to="/admin/verification-queue"
              />
              <QuickAction
                label={t('adminDashboard.openHrApprovals')}
                to="/admin/hr-approvals"
              />
              <QuickAction
                label={t('adminDashboard.openImportCandidates')}
                to="/admin/import-candidates"
              />
              <QuickAction
                label={t('adminDashboard.openImportedCandidates')}
                to="/admin/imported-candidates"
              />
            </div>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-6">
        <CardBody>
          <div className="mb-5 flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">
              {t('adminDashboard.relationshipOverviewTitle')}
            </h2>
          </div>
          {reviewQueueRows.length === 0 ? (
            <p className="text-sm text-muted">{t('adminDashboard.noRelationshipData')}</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border bg-white">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border bg-slate-50">
                  <tr>
                    <th className="px-4 py-3 font-medium">
                      {t('adminDashboard.nameColumn')}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t('adminDashboard.typeColumn')}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t('adminDashboard.verificationStatus')}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t('adminDashboard.lastActivity')}
                    </th>
                    <th className="px-4 py-3 font-medium">
                      {t('adminDashboard.requiredAction')}
                    </th>
                    <th className="px-4 py-3 font-medium" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {reviewQueueRows.map((row) => (
                    <tr key={row.key}>
                      <td className="px-4 py-3 font-medium text-foreground">{row.name}</td>
                      <td className="px-4 py-3 text-muted">{row.type}</td>
                      <td className="px-4 py-3">{row.status}</td>
                      <td className="px-4 py-3 text-muted">
                        {formatDate(row.lastActivity)}
                      </td>
                      <td className="px-4 py-3">{row.requiredAction}</td>
                      <td className="px-4 py-3 text-right">
                        <Link to={row.to}>
                          <Button variant="ghost" size="sm">
                            {t('adminDashboard.manage')}
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="space-y-6">
          <Card>
            <CardBody>
              <div className="mb-5 flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-foreground">
                  {t('adminDashboard.recentActivityTitle')}
                </h2>
              </div>
              {recentActivity.length === 0 ? (
                <p className="text-sm text-muted">{t('adminDashboard.noRecentActivity')}</p>
              ) : (
                <ul className="space-y-3">
                  {recentActivity.map((item) => (
                    <li key={item.key} className="rounded-lg border border-border p-3">
                      <p className="font-medium text-foreground">{item.label}</p>
                      <p className="text-sm text-muted">{item.subject}</p>
                      <p className="mt-1 text-xs text-muted">{formatDate(item.date)}</p>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody>
              <div className="mb-5 flex items-center gap-2">
                <ClipboardList className="h-5 w-5 text-primary" />
                <h2 className="font-semibold text-foreground">
                  {t('adminDashboard.followUpTitle')}
                </h2>
              </div>
              {followUps.length === 0 ? (
                <p className="text-sm text-muted">{t('adminDashboard.noFollowUps')}</p>
              ) : (
                <ul className="space-y-3">
                  {followUps.slice(0, 6).map((item) => (
                    <li
                      key={item.key}
                      className="flex items-center justify-between gap-3 rounded-lg border border-border p-3"
                    >
                      <div>
                        <p className="font-medium text-foreground">{item.title}</p>
                        <p className="text-sm text-muted">{item.detail}</p>
                      </div>
                      <Link to={item.to}>
                        <Button variant="ghost" size="sm">
                          {t('adminDashboard.manage')}
                        </Button>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        </div>
      </div>
    </div>
  )
}

function QueueMetric({
  label,
  value,
  to,
}: {
  label: string
  value: number
  to: string
}) {
  return (
    <Link to={to} className="rounded-xl border border-border p-4 hover:bg-slate-50">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 text-3xl font-semibold text-foreground">{value}</p>
    </Link>
  )
}

function QuickAction({ label, to }: { label: string; to: string }) {
  return (
    <Link to={to}>
      <Button variant="secondary" className="w-full justify-between">
        {label}
        <ArrowRight className="h-4 w-4" />
      </Button>
    </Link>
  )
}
