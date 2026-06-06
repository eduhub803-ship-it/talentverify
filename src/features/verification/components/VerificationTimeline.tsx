import { Check } from 'lucide-react'
import type { VerificationStatus } from '@/types/domain'
import { cn } from '@/lib/utils'

const steps: { key: VerificationStatus; label: string }[] = [
  { key: 'draft', label: 'Draft' },
  { key: 'pending', label: 'Submitted' },
  { key: 'under_review', label: 'Under review' },
  { key: 'verified', label: 'Verified' },
]

const order: VerificationStatus[] = [
  'draft',
  'pending',
  'under_review',
  'verified',
  'rejected',
]

function stepIndex(status: VerificationStatus): number {
  if (status === 'rejected') return 2
  return order.indexOf(status)
}

export function VerificationTimeline({ status }: { status: VerificationStatus }) {
  const current = stepIndex(status)
  const isRejected = status === 'rejected'

  return (
    <ol className="space-y-0">
      {steps.map((step, i) => {
        const done = i < current || (status === 'verified' && i <= 3)
        const active = i === current && !isRejected
        const rejectedHere = isRejected && step.key === 'under_review'

        return (
          <li key={step.key} className="relative flex gap-4 pb-8 last:pb-0">
            {i < steps.length - 1 && (
              <span
                className={cn(
                  'absolute left-[15px] top-8 h-full w-0.5',
                  done ? 'bg-primary' : 'bg-border',
                )}
              />
            )}
            <span
              className={cn(
                'relative z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 text-sm font-medium',
                done && !rejectedHere && 'border-primary bg-primary text-white',
                active && 'border-primary bg-white text-primary',
                rejectedHere && 'border-red-500 bg-red-50 text-red-600',
                !done && !active && !rejectedHere && 'border-border bg-white text-muted',
              )}
            >
              {done && !rejectedHere ? <Check className="h-4 w-4" /> : i + 1}
            </span>
            <div className="pt-0.5">
              <p
                className={cn(
                  'font-medium',
                  active ? 'text-primary' : 'text-foreground',
                  rejectedHere && 'text-red-600',
                )}
              >
                {step.label}
                {rejectedHere && ' — Rejected'}
              </p>
            </div>
          </li>
        )
      })}
    </ol>
  )
}
