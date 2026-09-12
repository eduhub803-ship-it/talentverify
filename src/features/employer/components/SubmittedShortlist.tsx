import { useQuery } from '@tanstack/react-query'
import { Users } from 'lucide-react'
import { Badge } from '@/features/shared/components/ui/Badge'
import { useAuthStore } from '@/stores/auth-store'
import { formatDate } from '@/lib/utils'
import type { EmployerServiceRequest } from '@/types/domain'
import { fetchSubmittedTalentShortlist } from '../actions'
import { employerQueryKeys } from '../queryKeys'

/**
 * Service 34, employer side. Returns nothing until SEH submits, so a draft
 * shortlist is never visible even if this component is rendered early.
 */
export function SubmittedShortlist({
  request,
  t,
}: {
  request: EmployerServiceRequest
  t: (key: string) => string
}) {
  const actor = useAuthStore((state) => state.profile)

  const { data: shortlist = [] } = useQuery({
    queryKey: employerQueryKeys.talentShortlist(request.id),
    queryFn: () => fetchSubmittedTalentShortlist({ actor, requestId: request.id }),
  })

  if (!request.shortlistSubmittedAt) {
    return (
      <p className="rounded-lg border border-border bg-slate-50 px-3 py-2 text-sm text-muted">
        {t('talentRequest.pendingShortlist')}
      </p>
    )
  }

  return (
    <div className="space-y-3 rounded-xl border border-border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 font-semibold text-foreground">
          <Users className="h-4 w-4 text-primary" />
          {t('talentRequest.yourShortlist')}
        </h3>
        <Badge variant="success">{shortlist.length}</Badge>
      </div>
      <p className="text-xs text-muted">
        {t('talentRequest.submittedOn')} {formatDate(request.shortlistSubmittedAt)}
      </p>

      <div className="space-y-2">
        {shortlist.map((item) => (
          <div key={item.id} className="rounded-lg border border-border px-3 py-2">
            <p className="font-medium text-foreground">
              {item.rank}. {item.candidateName}
            </p>
            <p className="text-xs text-muted">
              {[item.headline, item.location, item.sehTalentId].filter(Boolean).join(' · ')}
            </p>
            {item.skills && item.skills.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {item.skills.slice(0, 6).map((skill) => (
                  <Badge key={skill}>{skill}</Badge>
                ))}
              </div>
            )}
            {item.employerNote && (
              <p className="mt-2 break-words text-sm text-foreground">{item.employerNote}</p>
            )}
          </div>
        ))}
      </div>

      <p className="text-xs text-muted">{t('talentRequest.contactNote')}</p>
    </div>
  )
}
