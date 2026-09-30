import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ShieldCheck } from 'lucide-react'
import { Footer } from '@/features/shared/components/Footer'

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
        <div className="hidden w-1/2 flex-col justify-between bg-gradient-to-br from-primary to-primary-700 p-12 text-white lg:flex">
        <Link to="/" className="flex items-center gap-2 text-lg font-semibold">
          <ShieldCheck className="h-7 w-7" />
          TalentVerify
        </Link>
        <div>
          <h2 className="text-3xl font-semibold leading-tight">
            Verified talent.
            <br />
            Trusted hiring.
          </h2>
          <p className="mt-4 max-w-md text-primary-50/90">
            A professional platform where credentials are verified before candidates
            become visible to approved HR organizations.
          </p>
        </div>
        <p className="text-sm text-white/60">Enterprise-grade verification</p>
      </div>
      <div className="flex w-full flex-col justify-center px-6 py-12 lg:w-1/2 lg:px-16">
        <div className="mx-auto w-full max-w-md">
          <Link to="/" className="mb-8 flex items-center gap-2 font-semibold text-foreground lg:hidden">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-white">
              <ShieldCheck className="h-5 w-5" />
            </span>
            TalentVerify
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
