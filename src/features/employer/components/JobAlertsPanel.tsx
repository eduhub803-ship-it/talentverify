import { useContext, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, BellRing, Plus, Trash2 } from 'lucide-react'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
import { Button } from '@/features/shared/components/ui/Button'
import { Badge } from '@/features/shared/components/ui/Badge'
import { Input } from '@/features/shared/components/ui/Input'
import { LanguageContext } from '@/context/LanguageContext'
import { useAuthStore } from '@/stores/auth-store'
import { formatDate } from '@/lib/utils'
import { notificationsQueryKeys } from '@/features/notifications/queryKeys'
import type { JobAlert, OpportunityTrack } from '@/types/domain'
import {
  createJobAlert,
  deleteJobAlert,
  fetchMyJobAlerts,
  setJobAlertActive,
} from '../actions'
import { employerQueryKeys } from '../queryKeys'
import { JOB_ALERT_FREQUENCIES, type AlertDraft } from '../alerts'
import { OPPORTUNITY_TRACKS } from '../matching'

const emptyDraft: AlertDraft = {
  name: '',
  keywords: '',
  location: '',
  jobTypes: '',
  tracks: [],
  exclusiveOnly: false,
  frequency: 'immediate',
}

/** Service 30: saved searches that notify the candidate when a job matches. */
export function JobAlertsPanel({ candidateId }: { candidateId: string }) {
  const actor = useAuthStore((state) => state.profile)
  const qc = useQueryClient()
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState<AlertDraft>(emptyDraft)
  const [error, setError] = useState<string | null>(null)

  const { data: alerts = [] } = useQuery({
    queryKey: employerQueryKeys.alerts(candidateId),
    queryFn: () => fetchMyJobAlerts(actor, candidateId),
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: employerQueryKeys.alerts(candidateId) })
    qc.invalidateQueries({ queryKey: notificationsQueryKeys.root })
  }

  const create = useMutation({
    mutationFn: () => createJobAlert({ actor, candidateId, draft }),
    onSuccess: () => {
      invalidate()
      setDraft(emptyDraft)
      setOpen(false)
      setError(null)
    },
    onError: (mutationError) =>
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'This alert could not be saved.',
      ),
  })

  const toggle = useMutation({
    mutationFn: (alert: JobAlert) =>
      setJobAlertActive({ actor, candidateId, alertId: alert.id, active: !alert.active }),
    onSuccess: invalidate,
  })

  const remove = useMutation({
    mutationFn: (alert: JobAlert) =>
      deleteJobAlert({ actor, candidateId, alertId: alert.id }),
    onSuccess: invalidate,
  })

  const toggleTrack = (track: OpportunityTrack) => {
    setDraft((current) => ({
      ...current,
      tracks: current.tracks.includes(track)
        ? current.tracks.filter((item) => item !== track)
        : [...current.tracks, track],
    }))
  }

  return (
    <Card className="mb-6">
      <CardBody className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <BellRing className="h-4 w-4 text-primary" />
            <h2 className="font-semibold text-foreground">{t('jobAlerts.title')}</h2>
            <Badge>{alerts.length}</Badge>
          </div>
          <Button
            type="button"
            size="sm"
            variant={open ? 'secondary' : 'primary'}
            onClick={() => {
              setError(null)
              setOpen((value) => !value)
            }}
          >
            {open ? t('jobAlerts.cancel') : <>
              <Plus className="h-4 w-4" />
              {t('jobAlerts.create')}
            </>}
          </Button>
        </div>

        <p className="text-sm text-muted">{t('jobAlerts.description')}</p>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {open && (
          <div className="space-y-3 rounded-xl border border-border p-4">
            <Input
              label={t('jobAlerts.name')}
              placeholder={t('jobAlerts.namePlaceholder')}
              value={draft.name}
              onChange={(event) => setDraft({ ...draft, name: event.target.value })}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <Input
                label={t('jobAlerts.keywords')}
                hint={t('jobAlerts.commaSeparated')}
                value={draft.keywords}
                onChange={(event) => setDraft({ ...draft, keywords: event.target.value })}
              />
              <Input
                label={t('jobAlerts.location')}
                value={draft.location}
                onChange={(event) => setDraft({ ...draft, location: event.target.value })}
              />
              <Input
                label={t('jobAlerts.jobTypes')}
                hint={t('jobAlerts.commaSeparated')}
                value={draft.jobTypes}
                onChange={(event) => setDraft({ ...draft, jobTypes: event.target.value })}
              />
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  {t('jobAlerts.frequency')}
                </label>
                <select
                  className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm"
                  value={draft.frequency}
                  onChange={(event) =>
                    setDraft({
                      ...draft,
                      frequency: event.target.value as AlertDraft['frequency'],
                    })
                  }
                >
                  {JOB_ALERT_FREQUENCIES.map((frequency) => (
                    <option key={frequency} value={frequency}>
                      {t(`jobAlerts.frequency.${frequency}`)}
                    </option>
                  ))}
                </select>
                <p className="text-xs text-muted">{t('jobAlerts.digestNote')}</p>
              </div>
            </div>

            <div className="space-y-1.5">
              <p className="text-sm font-medium text-foreground">{t('jobAlerts.tracks')}</p>
              <div className="flex flex-wrap gap-2">
                {OPPORTUNITY_TRACKS.map((track) => (
                  <Button
                    key={track}
                    type="button"
                    size="sm"
                    variant={draft.tracks.includes(track) ? 'primary' : 'secondary'}
                    aria-pressed={draft.tracks.includes(track)}
                    onClick={() => toggleTrack(track)}
                  >
                    {t(`candidateJobs.track.${track}`)}
                  </Button>
                ))}
                <Button
                  type="button"
                  size="sm"
                  variant={draft.exclusiveOnly ? 'primary' : 'secondary'}
                  aria-pressed={draft.exclusiveOnly}
                  onClick={() =>
                    setDraft({ ...draft, exclusiveOnly: !draft.exclusiveOnly })
                  }
                >
                  {t('candidateJobs.exclusiveBadge')}
                </Button>
              </div>
            </div>

            <Button type="button" isLoading={create.isPending} onClick={() => create.mutate()}>
              {t('jobAlerts.save')}
            </Button>
          </div>
        )}

        {alerts.length === 0 ? (
          <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted">
            {t('jobAlerts.empty')}
          </p>
        ) : (
          <div className="space-y-2">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border px-3 py-2"
              >
                <div className="min-w-0">
                  <p className="font-medium text-foreground">{alert.name}</p>
                  <p className="text-xs text-muted">
                    {[
                      alert.keywords.join(', '),
                      alert.location,
                      alert.jobTypes.join(', '),
                      alert.exclusiveOnly ? t('candidateJobs.exclusiveBadge') : '',
                      ...alert.tracks.map((track) => t(`candidateJobs.track.${track}`)),
                    ]
                      .filter(Boolean)
                      .join(' · ')}
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    {t(`jobAlerts.frequency.${alert.frequency}`)} ·{' '}
                    {alert.matchCount > 0
                      ? `${alert.matchCount} ${t('jobAlerts.matches')} · ${formatDate(alert.lastMatchedAt)}`
                      : t('jobAlerts.noMatchesYet')}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge variant={alert.active ? 'success' : 'default'}>
                    {alert.active ? t('jobAlerts.active') : t('jobAlerts.paused')}
                  </Badge>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    isLoading={toggle.isPending && toggle.variables?.id === alert.id}
                    onClick={() => toggle.mutate(alert)}
                  >
                    {alert.active ? t('jobAlerts.pause') : t('jobAlerts.resume')}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    aria-label={t('jobAlerts.delete')}
                    isLoading={remove.isPending && remove.variables?.id === alert.id}
                    onClick={() => remove.mutate(alert)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  )
}
