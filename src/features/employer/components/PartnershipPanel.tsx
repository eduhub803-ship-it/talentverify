import { useContext, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check } from 'lucide-react'
import { Button } from '@/features/shared/components/ui/Button'
import { Badge } from '@/features/shared/components/ui/Badge'
import { Input } from '@/features/shared/components/ui/Input'
import { LanguageContext } from '@/context/LanguageContext'
import { useAuthStore } from '@/stores/auth-store'
import { notificationsQueryKeys } from '@/features/notifications/queryKeys'
import type { HrOrganization, PartnershipStatus } from '@/types/domain'
import { adminQueryKeys } from '@/features/admin/queryKeys'
import { setEmployerPartnership } from '../actions'
import { employerQueryKeys } from '../queryKeys'
import { EMPLOYER_PLAN_FEATURES, entitlementsFor, effectivePlanOf } from '../plans'

const STATUSES: PartnershipStatus[] = ['pending', 'active', 'inactive', 'expired']

/**
 * Service 36, SEH side: the partnership is an account entitlement, managed here
 * rather than requested by the employer. Internal notes stay on this screen.
 */
export function PartnershipPanel({ organization }: { organization: HrOrganization }) {
  const actor = useAuthStore((state) => state.profile)
  const qc = useQueryClient()
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

  const [status, setStatus] = useState<PartnershipStatus>(
    organization.partnershipStatus ?? 'pending',
  )
  const [startDate, setStartDate] = useState(organization.partnershipStartDate ?? '')
  const [endDate, setEndDate] = useState(organization.partnershipEndDate ?? '')
  const [notes, setNotes] = useState(organization.partnershipNotes ?? '')
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const entitlements = entitlementsFor(organization)
  const effective = effectivePlanOf(organization)

  const save = useMutation({
    mutationFn: () =>
      setEmployerPartnership({
        actor,
        organizationId: organization.id,
        status,
        startDate: startDate || null,
        endDate: endDate || null,
        notes: notes.trim() || null,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: adminQueryKeys.organizations })
      qc.invalidateQueries({ queryKey: employerQueryKeys.root })
      qc.invalidateQueries({ queryKey: notificationsQueryKeys.root })
      setSaved(true)
      setError(null)
    },
    onError: (mutationError) => {
      setSaved(false)
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'The partnership could not be saved.',
      )
    },
  })

  const isPartner = organization.plan === 'partner'

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-border bg-slate-50/60 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">
          {t('employer.partnership.title')}
        </p>
        <Badge variant="default">
          {t('employer.partnership.effectivePlan')}: {t(`employer.plan.${effective}`)}
        </Badge>
      </div>

      {!isPartner ? (
        <p className="text-sm text-muted">{t('employer.partnership.notPartner')}</p>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-muted">
                {t('employer.partnership.statusLabel')}
              </label>
              <select
                className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm"
                value={status}
                onChange={(event) => setStatus(event.target.value as PartnershipStatus)}
              >
                {STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {t(`employer.partnership.status.${value}`)}
                  </option>
                ))}
              </select>
            </div>
            <Input
              type="date"
              label={t('employer.partnership.startDate')}
              value={startDate ? startDate.slice(0, 10) : ''}
              onChange={(event) => setStartDate(event.target.value)}
            />
            <Input
              type="date"
              label={t('employer.partnership.endDate')}
              value={endDate ? endDate.slice(0, 10) : ''}
              onChange={(event) => setEndDate(event.target.value)}
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-medium text-muted">
              {t('employer.partnership.internalNotes')}
            </label>
            <textarea
              className="min-h-[60px] w-full rounded-lg border border-border px-3 py-2 text-sm"
              placeholder={t('employer.partnership.internalNotesHint')}
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
            />
          </div>
        </>
      )}

      <div>
        <p className="text-xs font-medium text-muted">
          {t('employer.partnership.entitlements')}
        </p>
        <ul className="mt-1 space-y-0.5 text-xs text-muted">
          {EMPLOYER_PLAN_FEATURES[effective].map((feature) => (
            <li key={feature.key}>• {t(feature.key)}</li>
          ))}
        </ul>
        {!entitlements.partnerBadge && isPartner && (
          <p className="mt-1 text-xs text-warning">
            {t('employer.partnership.inactiveFallback')}
          </p>
        )}
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}
      {saved && !error && (
        <p className="inline-flex items-center gap-2 text-sm text-success">
          <Check className="h-4 w-4" />
          {t('employer.partnership.saved')}
        </p>
      )}

      {isPartner && (
        <Button type="button" size="sm" isLoading={save.isPending} onClick={() => save.mutate()}>
          {t('employer.partnership.save')}
        </Button>
      )}
    </div>
  )
}
