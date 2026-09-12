import { useContext, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { AlertTriangle, Check, Plus, Send, Trash2 } from 'lucide-react'
import { Button } from '@/features/shared/components/ui/Button'
import { Badge } from '@/features/shared/components/ui/Badge'
import { Input } from '@/features/shared/components/ui/Input'
import { LanguageContext } from '@/context/LanguageContext'
import { useAuthStore } from '@/stores/auth-store'
import { formatDate } from '@/lib/utils'
import { notificationsQueryKeys } from '@/features/notifications/queryKeys'
import type { EmployerServiceRequest } from '@/types/domain'
import {
  addTalentRequestCandidate,
  fetchEligibleTalentPool,
  fetchTalentShortlistForStaff,
  removeTalentRequestCandidate,
  submitTalentShortlist,
} from '../actions'
import { employerQueryKeys } from '../queryKeys'

/**
 * Service 34, SEH side. The pool is the existing verified + employer-visible
 * search; the shortlist is request-scoped and stays invisible to the employer
 * until it is submitted.
 */
export function TalentShortlistBuilder({
  request,
}: {
  request: EmployerServiceRequest
}) {
  const actor = useAuthStore((state) => state.profile)
  const qc = useQueryClient()
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

  const [search, setSearch] = useState('')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)

  const submitted = Boolean(request.shortlistSubmittedAt)

  const { data: shortlist = [] } = useQuery({
    queryKey: employerQueryKeys.talentShortlist(request.id),
    queryFn: () => fetchTalentShortlistForStaff({ actor, requestId: request.id }),
  })

  const { data: pool = [] } = useQuery({
    queryKey: employerQueryKeys.talentPool(request.id),
    queryFn: () => fetchEligibleTalentPool({ actor, requestId: request.id }),
    enabled: !submitted,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: employerQueryKeys.root })
    qc.invalidateQueries({ queryKey: notificationsQueryKeys.root })
  }

  const add = useMutation({
    mutationFn: (candidateId: string) =>
      addTalentRequestCandidate({
        actor,
        requestId: request.id,
        candidateId,
        employerNote: note,
      }),
    onSuccess: () => {
      invalidate()
      setNote('')
      setError(null)
    },
    onError: (mutationError) =>
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'This candidate could not be added.',
      ),
  })

  const remove = useMutation({
    mutationFn: (itemId: string) => removeTalentRequestCandidate({ actor, itemId }),
    onSuccess: () => {
      invalidate()
      setError(null)
    },
    onError: (mutationError) =>
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'This candidate could not be removed.',
      ),
  })

  const submit = useMutation({
    mutationFn: () => submitTalentShortlist({ actor, requestId: request.id }),
    onSuccess: () => {
      invalidate()
      setError(null)
    },
    onError: (mutationError) =>
      setError(
        mutationError instanceof Error
          ? mutationError.message
          : 'The shortlist could not be submitted.',
      ),
  })

  const filteredPool = useMemo(() => {
    const query = search.trim().toLowerCase()
    if (!query) return pool.slice(0, 8)
    return pool
      .filter(
        (candidate) =>
          candidate.candidateName.toLowerCase().includes(query) ||
          (candidate.headline ?? '').toLowerCase().includes(query) ||
          (candidate.location ?? '').toLowerCase().includes(query) ||
          candidate.skills.some((skill) => skill.toLowerCase().includes(query)),
      )
      .slice(0, 8)
  }, [pool, search])

  const requested = request.input.candidateCount ?? '—'

  return (
    <div className="space-y-4 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h4 className="text-sm font-semibold text-foreground">
          {t('talentRequest.shortlistTitle')}
        </h4>
        <Badge variant={submitted ? 'success' : 'default'}>
          {shortlist.length} / {requested}
        </Badge>
      </div>

      {submitted ? (
        <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-success">
          <Check className="me-1 inline h-4 w-4" />
          {t('talentRequest.submittedOn')} {formatDate(request.shortlistSubmittedAt)}
        </p>
      ) : (
        <p className="text-xs text-muted">{t('talentRequest.draftNote')}</p>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {shortlist.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border px-3 py-3 text-center text-sm text-muted">
          {t('talentRequest.shortlistEmpty')}
        </p>
      ) : (
        <div className="space-y-2">
          {shortlist.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border px-3 py-2"
            >
              <div className="min-w-0">
                <p className="font-medium text-foreground">
                  {item.rank}. {item.candidateName}
                </p>
                <p className="text-xs text-muted">
                  {[item.headline, item.location, item.sehTalentId]
                    .filter(Boolean)
                    .join(' · ')}
                </p>
                {item.employerNote && (
                  <p className="mt-1 break-words text-xs text-foreground">
                    {item.employerNote}
                  </p>
                )}
              </div>
              {!submitted && (
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  aria-label={t('talentRequest.remove')}
                  isLoading={remove.isPending && remove.variables === item.id}
                  onClick={() => remove.mutate(item.id)}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {!submitted && (
        <>
          <div className="space-y-2 rounded-lg border border-border p-3">
            <p className="text-sm font-medium text-foreground">
              {t('talentRequest.addFromPool')}
            </p>
            <p className="text-xs text-muted">{t('talentRequest.poolNote')}</p>
            <Input
              name="talent-pool-search"
              placeholder={t('talentRequest.searchPool')}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
            <Input
              name="talent-shortlist-note"
              label={t('talentRequest.employerNote')}
              hint={t('talentRequest.employerNoteHint')}
              value={note}
              onChange={(event) => setNote(event.target.value)}
            />

            {filteredPool.length === 0 ? (
              <p className="text-sm text-muted">{t('talentRequest.poolEmpty')}</p>
            ) : (
              <div className="space-y-2">
                {filteredPool.map((candidate) => (
                  <div
                    key={candidate.candidateId}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border px-3 py-2"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {candidate.candidateName}
                      </p>
                      <p className="text-xs text-muted">
                        {[candidate.headline, candidate.location]
                          .filter(Boolean)
                          .join(' · ')}
                      </p>
                    </div>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      isLoading={add.isPending && add.variables === candidate.candidateId}
                      disabled={add.isPending}
                      onClick={() => add.mutate(candidate.candidateId)}
                    >
                      <Plus className="h-4 w-4" />
                      {t('talentRequest.add')}
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            type="button"
            isLoading={submit.isPending}
            disabled={shortlist.length === 0}
            onClick={() => submit.mutate()}
          >
            <Send className="h-4 w-4" />
            {t('talentRequest.submitShortlist')}
          </Button>
        </>
      )}
    </div>
  )
}
