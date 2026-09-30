import { Link } from 'react-router-dom'
import { BRAND } from '@/features/shared/brand'
import { cn } from '@/lib/utils'

const images = {
  logo: BRAND.assets.logo,
  mark: BRAND.assets.mark,
  wordmark: BRAND.assets.wordmark,
} as const

type BrandLogoVariant = keyof typeof images

const defaultImageClass: Record<BrandLogoVariant, string> = {
  logo: 'h-9 w-auto',
  mark: 'h-9 w-auto',
  wordmark: 'h-7 w-auto',
}

interface BrandLogoProps {
  variant?: BrandLogoVariant
  to?: string | null
  className?: string
  imgClassName?: string
}

export function BrandLogo({
  variant = 'logo',
  to = '/',
  className,
  imgClassName,
}: BrandLogoProps) {
  const image = images[variant]
  const label = variant === 'mark' ? `${BRAND.name} mark` : BRAND.name
  const imageElement = (
    <img
      src={image.src}
      width={image.width}
      height={image.height}
      alt={label}
      draggable={false}
      className={cn(
        'block select-none object-contain [transform:none]',
        defaultImageClass[variant],
        imgClassName,
      )}
    />
  )

  if (!to) {
    return (
      <span className={cn('inline-flex items-center', className)} dir="ltr">
        {imageElement}
      </span>
    )
  }

  return (
    <Link
      to={to}
      aria-label={BRAND.name}
      className={cn('inline-flex items-center', className)}
      dir="ltr"
    >
      {imageElement}
    </Link>
  )
}

export function ResponsiveBrandLogo({
  className,
  logoClassName,
  markClassName,
}: {
  className?: string
  logoClassName?: string
  markClassName?: string
}) {
  return (
    <span className={cn('inline-flex items-center', className)} dir="ltr">
      <BrandLogo
        variant="mark"
        className={cn('sm:hidden', markClassName)}
        imgClassName="h-9 w-auto"
      />
      <BrandLogo
        variant="logo"
        className={cn('hidden sm:inline-flex', logoClassName)}
        imgClassName="h-9 w-auto"
      />
    </span>
  )
}
