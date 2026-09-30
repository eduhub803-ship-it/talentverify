import type { VerificationStatus } from '@/types/domain'
import { cn } from '@/lib/utils'

const config: Record<
  VerificationStatus,
  { label: string; dot: string; bg: string; text: string }
> = {
  draft: {
    label: 'Draft',
    dot: 'bg-muted',
    bg: 'bg-slate-100',
    text: 'text-muted',
  },
  pending: {
    label: 'Pending Review',
    dot: 'bg-warning',
    bg: 'bg-amber-50',
    text: 'text-warning',
  },
  under_review: {
    label: 'Under Review',
    dot: 'bg-primary',
    bg: 'bg-primary-50',
    text: 'text-primary',
  },
  verified: {
    label: 'Verified',
    dot: 'bg-success',
    bg: 'bg-green-50',
    text: 'text-success',
  },
  rejected: {
    label: 'Rejected',
    dot: 'bg-red-500',
    bg: 'bg-red-50',
    text: 'text-red-600',
  },
}

export function StatusBadge({ status }: { status: VerificationStatus }) {
  const c = config[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium',
        c.bg,
        c.text,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', c.dot)} />
      {c.label}
    </span>
  )
}
