import { useContext, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, ShieldCheck } from 'lucide-react'
import { PageHeader } from '@/features/shared/components/layout/PageHeader'
import { Card, CardBody, CardHeader } from '@/features/shared/components/ui/Card'
import { Button } from '@/features/shared/components/ui/Button'
import { Badge } from '@/features/shared/components/ui/Badge'
import { Input } from '@/features/shared/components/ui/Input'
import { Skeleton } from '@/features/shared/components/ui/Skeleton'
import { LanguageContext } from '@/context/LanguageContext'
import { useAuthStore } from '@/stores/auth-store'
import { formatDate } from '@/lib/utils'
import { notificationsQueryKeys } from '@/features/notifications/queryKeys'
import { fetchEmployerPlanUsage, saveOrganizationProfile } from '../actions'
import { employerQueryKeys } from '../queryKeys'
import { EMPLOYER_PLAN_FEATURES, EMPLOYER_PLAN_LIMITS, partnershipStatusOf } from '../plans'
import type { HrOrganization, Profile } from '@/types/domain'

/** Services 31, 32 and 33 from the employer's side: profile, verification, plan. */
export function EmployerProfilePage() {
  const actor = useAuthStore((state) => state.profile)
  const qc = useQueryClient()
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

  const { data: usage, isLoading } = useQuery({
    queryKey: employerQueryKeys.planUsage(actor?.id ?? 'anonymous'),
    queryFn: () => fetchEmployerPlanUsage(actor),
  })

  const organization = usage?.organization ?? null

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  if (!organization) {
    return (
      <div>
        <PageHeader title={t('employer.profile.title')} />
        <Card>
          <CardBody>
            <p className="text-sm text-muted">{t('employer.profile.noOrganization')}</p>
          </CardBody>
        </Card>
      </div>
    )
  }

  const verified = organization.status === 'approved'
  const plan = usage?.effectivePlan ?? 'free'
  const declaredPlan = usage?.plan ?? 'free'
  const partnershipStatus = partnershipStatusOf(organization)
  const limits = EMPLOYER_PLAN_LIMITS[plan]

  return (
    <div>
      <PageHeader
        title={t('employer.profile.title')}
        description={t('employer.profile.description')}
        actions={
          <Badge variant={verified ? 'success' : 'warning'}>
            {verified ? (
              <>
                <ShieldCheck className="me-1 h-3.5 w-3.5" />
                {t('employer.profile.verified')}
              </>
            ) : (
              t(`employer.profile.status.${organization.status}`)
            )}
          </Badge>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[1fr_360px]">
        <ProfileForm
          key={organization.id}
          organization={organization}
          verified={verified}
          actor={actor}
          t={t}
          onSaved={() => {
            qc.invalidateQueries({ queryKey: employerQueryKeys.root })
            qc.invalidateQueries({ queryKey: notificationsQueryKeys.root })
          }}
        />

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-foreground">{t('employer.plan.title')}</h2>
              <Badge
                variant={
                  plan === 'partner' ? 'success' : plan === 'pro' ? 'primary' : 'default'
                }
              >
                {t(`employer.plan.${plan}`)}
              </Badge>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            {declaredPlan === 'partner' && (
              <div className="rounded-lg border border-border px-3 py-2 text-sm">
                <p className="text-muted">{t('employer.partnership.statusLabel')}</p>
                <p className="mt-1 font-semibold text-foreground">
                  {t(`employer.partnership.status.${partnershipStatus ?? 'pending'}`)}
                </p>
                {(organization.partnershipStartDate || organization.partnershipEndDate) && (
                  <p className="mt-1 text-xs text-muted">
                    {organization.partnershipStartDate
                      ? formatDate(organization.partnershipStartDate)
                      : '—'}
                    {' → '}
                    {organization.partnershipEndDate
                      ? formatDate(organization.partnershipEndDate)
                      : t('employer.partnership.openEnded')}
                  </p>
                )}
                {partnershipStatus !== 'active' && (
                  <p className="mt-1 text-xs text-warning">
                    {t('employer.partnership.inactiveFallback')}
                  </p>
                )}
              </div>
            )}

            <ul className="space-y-1.5 text-sm text-muted">
              {EMPLOYER_PLAN_FEATURES[plan].map((feature) => (
                <li key={feature.key}>• {t(feature.key)}</li>
              ))}
            </ul>

            {usage && (
              <div className="rounded-lg border border-border px-3 py-2 text-sm">
                <p className="text-muted">{t('employer.plan.activePosts')}</p>
                <p className="mt-1 font-semibold text-foreground">
                  {usage.jobPosts.limit === null
                    ? `${usage.jobPosts.used} · ${t('employer.plan.unlimited')}`
                    : `${usage.jobPosts.used} / ${usage.jobPosts.limit}`}
                </p>
              </div>
            )}

            <div className="rounded-lg border border-border px-3 py-2 text-sm">
              <p className="text-muted">{t('employer.plan.searchResults')}</p>
              <p className="mt-1 font-semibold text-foreground">
                {limits.searchResults === null
                  ? t('employer.plan.unlimited')
                  : limits.searchResults}
              </p>
            </div>

            {plan !== 'free' && (
              <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted">
                {t('employer.plan.managedBySeh')}
              </p>
            )}

            {plan === 'free' && (
              <div className="rounded-lg border border-primary/30 bg-primary-50/40 px-3 py-2 text-sm">
                <p className="font-medium text-foreground">{t('employer.plan.upgradeTitle')}</p>
                <p className="mt-1 text-muted">{t('employer.plan.upgradeDescription')}</p>
                <a
                  href="mailto:careers@seh.jo?subject=TalentVerify%20Pro"
                  className="mt-2 inline-block"
                >
                  <Button type="button" size="sm" variant="secondary">
                    {t('employer.plan.contactSeh')}
                  </Button>
                </a>
              </div>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  )
}

/**
 * Initialises from props and is keyed by organization id, so the loaded profile
 * populates the form without a state-setting effect.
 */
function ProfileForm({
  organization,
  verified,
  actor,
  t,
  onSaved,
}: {
  organization: HrOrganization
  verified: boolean
  actor: Profile | null
  t: (key: string) => string
  onSaved: () => void
}) {
  const [form, setForm] = useState({
    website: organization.website ?? '',
    industry: organization.industry ?? '',
    description: organization.description ?? '',
    companySize: organization.companySize ?? '',
    location: organization.location ?? '',
    contactEmail: organization.contactEmail ?? '',
  })
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const save = useMutation({
    mutationFn: () =>
      saveOrganizationProfile({
        actor,
        organizationId: organization.id,
        website: form.website.trim() || null,
        industry: form.industry.trim() || null,
        description: form.description.trim() || null,
        companySize: form.companySize.trim() || null,
        location: form.location.trim() || null,
        contactEmail: form.contactEmail.trim() || null,
      }),
    onSuccess: () => {
      onSaved()
      setSaved(true)
      setError(null)
    },
    onError: (mutationError) => {
      setSaved(false)
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'This profile could not be saved.',
      )
    },
  })

  return (
    <Card>
      <CardBody className="space-y-4">
        <div>
          <h2 className="font-semibold text-foreground">{organization.name}</h2>
          <p className="text-sm text-muted">
            {verified
              ? t('employer.profile.verifiedHint')
              : t('employer.profile.pendingHint')}
          </p>
        </div>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
        {saved && !error && (
          <p className="inline-flex items-center gap-2 rounded-lg bg-green-50 px-3 py-2 text-sm text-success">
            <Check className="h-4 w-4" />
            {t('employer.profile.saved')}
          </p>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label={t('employer.profile.website')}
            placeholder="https://"
            value={form.website}
            onChange={(event) => setForm({ ...form, website: event.target.value })}
          />
          <Input
            label={t('employer.profile.industry')}
            value={form.industry}
            onChange={(event) => setForm({ ...form, industry: event.target.value })}
          />
          <Input
            label={t('employer.profile.companySize')}
            placeholder="e.g. 50-200"
            value={form.companySize}
            onChange={(event) => setForm({ ...form, companySize: event.target.value })}
          />
          <Input
            label={t('employer.profile.location')}
            value={form.location}
            onChange={(event) => setForm({ ...form, location: event.target.value })}
          />
          <Input
            label={t('employer.profile.contactEmail')}
            value={form.contactEmail}
            onChange={(event) => setForm({ ...form, contactEmail: event.target.value })}
          />
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            {t('employer.profile.about')}
          </label>
          <textarea
            className="min-h-[120px] w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            value={form.description}
            onChange={(event) => setForm({ ...form, description: event.target.value })}
          />
        </div>

        <Button type="button" isLoading={save.isPending} onClick={() => save.mutate()}>
          {t('employer.profile.save')}
        </Button>

        {organization.profileSubmittedAt && (
          <p className="text-xs text-muted">
            {t('employer.profile.lastSubmitted')}{' '}
            {formatDate(organization.profileSubmittedAt)}
          </p>
        )}
      </CardBody>
    </Card>
  )
}

