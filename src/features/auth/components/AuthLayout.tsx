import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Footer } from '@/features/shared/components/Footer'
import { BrandLogo } from '@/features/shared/components/brand/BrandLogo'
import { BRAND } from '@/features/shared/brand'

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string
  subtitle: string
  children: ReactNode
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="flex flex-1">
        <div className="hidden w-1/2 flex-col justify-between border-e border-border bg-white p-12 lg:flex">
          <BrandLogo variant="logo" imgClassName="h-10 w-auto" />
          <div>
            <h2 className="text-3xl font-semibold leading-tight">
              Verified talent.
              <br />
              Trusted hiring.
            </h2>
            <p className="mt-4 max-w-md text-muted">
              {BRAND.taglineEn} Credentials are reviewed before candidates become
              visible to approved HR organizations.
            </p>
          </div>
          <p className="text-sm text-muted">Enterprise-grade verification</p>
        </div>
        <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16">
          <div className="mx-auto w-full max-w-md">
            <Link to="/" className="mb-8 inline-flex lg:hidden" aria-label={BRAND.name}>
              <BrandLogo variant="mark" to={null} imgClassName="h-10 w-auto" />
            </Link>
            <h1 className="text-2xl font-semibold text-foreground">{title}</h1>
            <p className="mt-1 text-sm text-muted">{subtitle}</p>
            <div className="mt-8">{children}</div>
          </div>
        </div>
      </div>
      <Footer />
    </div>
  )
}
