import { cn } from '@/lib/utils'

const variants = {
  default: 'bg-primary-50 text-foreground',
  primary: 'bg-primary-100 text-primary-700',
  success: 'bg-green-50 text-success',
  warning: 'bg-amber-50 text-warning',
  danger: 'bg-red-50 text-error',
} as const

export function Badge({
  children,
  variant = 'default',
  className,
}: {
  children: React.ReactNode
  variant?: keyof typeof variants
  className?: string
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        variants[variant],
        className,
      )}
    >
      {children}
    </span>
  )
}
