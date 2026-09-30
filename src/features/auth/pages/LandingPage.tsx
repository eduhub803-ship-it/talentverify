import { useEffect, useContext } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  CheckCircle2,
  Globe2,
  LockKeyhole,
  Search,
  Shield,
  Sparkles,
} from 'lucide-react'
import { PublicShell } from '@/features/shared/components/layout/AppShell'
import { Footer } from '@/features/shared/components/Footer'
import { BrandLogo } from '@/features/shared/components/brand/BrandLogo'
import { Button } from '@/features/shared/components/ui/Button'
import { LanguageContext } from '@/context/LanguageContext'
import { BRAND } from '@/features/shared/brand'

const steps = [
  {
    icon: Shield,
    title: 'Upload & verify',
    description:
      'Candidates submit CVs and credentials for professional review by our verification team.',
  },
  {
    icon: BadgeCheck,
    title: 'Earn verified status',
    description:
      'Approved candidates receive a verified badge — visible only to approved HR organizations.',
  },
  {
    icon: Search,
    title: 'Trusted discovery',
    description:
      'HR teams search verified talent with advanced filters. No public browsing or social feeds.',
  },
]

const stats = [
  { value: '12K+', label: 'Verified candidates' },
  { value: '850+', label: 'Approved HR teams' },
  { value: '34K+', label: 'Credentials reviewed' },
]

const workflow = [
  'Candidate creates profile',
  'Documents are reviewed',
  'Verified badge is issued',
  'Approved HR teams search talent',
]

export function LandingPage() {
  const navigate = useNavigate()
  const language = useContext(LanguageContext)

  const t = language?.t ?? ((key: string) => key)

  // Redirect password recovery links to /reset-password
  useEffect(() => {
    const hash = window.location.hash
    if (hash) {
      const params = new URLSearchParams(hash.replace(/^#/, ''))
      const authType = params.get('type')
      if (authType === 'recovery') {
        navigate('/reset-password' + hash, { replace: true })
      }
    }
  }, [navigate])

  const currentLanguage =
    language?.lang ||
    localStorage.getItem('app_language') ||
    localStorage.getItem('language') ||
    localStorage.getItem('appLanguage') ||
    'en'

  const isArabic = currentLanguage === 'ar'

  const handleLanguageToggle = () => {
    const nextLanguage = isArabic ? 'en' : 'ar'

    if (language?.setLang) {
      language.setLang(nextLanguage)
      return
    }

    localStorage.setItem('language', nextLanguage)
    localStorage.setItem('appLanguage', nextLanguage)
    localStorage.setItem('talentverify_language', nextLanguage)

    window.location.reload()
  }

  return (
    <PublicShell>
      <main
        dir={isArabic ? 'rtl' : 'ltr'}
        className="min-h-screen overflow-hidden bg-surface"
      >
        <section className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="mb-10 flex justify-end">
            <button
              type="button"
              onClick={handleLanguageToggle}
              className="inline-flex h-11 items-center gap-2 rounded-lg border border-border bg-white px-4 text-sm font-medium text-muted shadow-sm transition hover:border-primary hover:text-primary"
            >
              <Globe2 className="h-4 w-4" />
              {isArabic ? 'English' : 'العربية'}
            </button>
          </div>

          <div className="mx-auto max-w-4xl text-center">
            <BrandLogo
              variant="logo"
              to={null}
              className="mb-8 justify-center"
              imgClassName="mx-auto h-12 w-auto sm:h-14"
            />

            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-medium text-primary shadow-sm">
              <Sparkles className="h-4 w-4" />
              {t('landing.eyebrow')}
            </div>

            <h1 className="mt-6 text-5xl font-extrabold tracking-normal text-brand-navy sm:text-6xl lg:text-7xl">
              {t('landing.headlineLine1')}
              <br />
              <span className="text-primary">{t('landing.headlineLine2')}</span>
            </h1>

            <p className="mx-auto mt-5 max-w-3xl text-xl font-semibold leading-8 text-brand-navy">
              {isArabic ? BRAND.taglineAr : BRAND.taglineEn}
            </p>

            <p className="mx-auto mt-4 max-w-2xl text-lg leading-8 text-muted">
              {t('landing.description')}
            </p>

            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link to="/register?role=candidate">
                <Button size="lg">
                  {t('landing.joinCandidate')}
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>

              <Link to="/register?role=hr">
                <Button variant="secondary" size="lg">
                  <Building2 className="h-4 w-4" />
                  {t('landing.registerHr')}
                </Button>
              </Link>
            </div>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-muted">
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Identity verified
              </span>
              <span className="flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                Credential review
              </span>
              <span className="flex items-center gap-2">
                <LockKeyhole className="h-4 w-4 text-primary" />
                Approval-based HR access
              </span>
            </div>
          </div>

          <div className="mx-auto mt-16 grid max-w-4xl gap-4 sm:grid-cols-3">
            {stats.map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-border bg-white p-6 text-center shadow-sm"
              >
                <div className="text-3xl font-extrabold text-brand-navy">
                  {item.value}
                </div>
                <div className="mt-1 text-sm text-muted">{item.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-20 grid gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.title}
                className="rounded-lg border border-border bg-white p-8 shadow-sm transition-colors duration-300 hover:border-primary/30"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-lg bg-primary-50 text-primary">
                  <step.icon className="h-6 w-6" />
                </div>

                <h3 className="text-lg font-bold text-brand-navy">
                  {t(step.title)}
                </h3>

                <p className="mt-3 text-sm leading-6 text-muted">
                  {t(step.description)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-20 rounded-lg border border-border bg-white p-8 shadow-sm sm:p-12">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold tracking-normal text-brand-navy">
                How Talent Verify works
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-muted">
                A private verification workflow built for candidates and approved HR organizations.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-4">
              {workflow.map((item, index) => (
                <div key={item} className="rounded-lg bg-primary-50 p-6">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <h3 className="font-semibold text-brand-navy">{item}</h3>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-16 rounded-lg bg-brand-navy p-8 text-center text-white shadow-xl sm:p-12">
            <LockKeyhole className="mx-auto h-10 w-10 text-brand-light" />
            <h2 className="mt-4 text-2xl font-bold text-white">
              {t('landing.notSocialTitle')}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-brand-light">
              {t('landing.notSocialDescription')}
            </p>
          </div>
        </section>
      </main>
      <Footer />
    </PublicShell>
  )
}
