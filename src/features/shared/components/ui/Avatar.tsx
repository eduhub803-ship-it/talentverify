import { cn } from '@/lib/utils'
import { initialsOf } from './initials'

const sizes = {
  sm: 'h-8 w-8 text-xs',
  md: 'h-12 w-12 text-sm',
  lg: 'h-20 w-20 text-xl',
} as const

/**
 * Profile photo with an initials fallback. Used everywhere identity matters so
 * a missing avatar never renders as a broken image or an empty circle.
 */
export function Avatar({
  src,
  name,
  email,
  size = 'md',
  className,
}: {
  src?: string | null
  name?: string | null
  email?: string | null
  size?: keyof typeof sizes
  className?: string
}) {
  const initials = initialsOf(name, email)

  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary-50 font-semibold text-primary',
        sizes[size],
        className,
      )}
      aria-hidden={!name && !email}
    >
      {src ? (
        <img
          src={src}
          alt={name ? `${name}` : 'Profile photo'}
          className="h-full w-full object-cover"
        />
      ) : (
        initials
      )}
    </span>
  )
}
