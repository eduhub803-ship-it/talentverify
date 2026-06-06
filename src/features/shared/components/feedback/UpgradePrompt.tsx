import { Crown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '../ui/Button'

export function UpgradePrompt({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-xl border border-primary/30 bg-gradient-to-br from-primary-50 to-white p-6 sm:flex-row sm:items-center sm:justify-between',
        className,
      )}
    >
      <div className="flex gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-primary text-white">
          <Crown className="h-6 w-6" />
        </div>
        <div>
          <h3 className="font-semibold text-foreground">Upgrade to TalentVerify Pro</h3>
          <p className="mt-1 text-sm text-muted">
            You&apos;ve used your 2 free CV evaluations. Pro unlocks unlimited AI
            evaluations, priority verification, and advanced insights.
          </p>
        </div>
      </div>
      <Button
        variant="primary"
        onClick={() =>
          window.alert('Pro billing coming soon. Contact sales@talentverify.com')
        }
      >
        Upgrade to Pro
      </Button>
    </div>
  )
}
