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
import { Button } from '@/features/shared/components/ui/Button'
import { LanguageContext } from '@/context/LanguageContext'

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
  const languageApi = language as any

  const t = languageApi?.t ?? ((key: string) => key)

  // Detect and redirect recovery token to /reset-password
  useEffect(() => {
    const hash = window.location.hash
    if (hash.includes('type=recovery') || hash.includes('access_token')) {
      navigate('/reset-password' + hash, { replace: true })
    }
  }, [])

  const currentLanguage =
    languageApi?.language ||
    languageApi?.locale ||
    languageApi?.currentLanguage ||
    localStorage.getItem('language') ||
    localStorage.getItem('appLanguage') ||
    'en'

  const isArabic = currentLanguage === 'ar'

  const handleLanguageToggle = () => {
    const nextLanguage = isArabic ? 'en' : 'ar'

    if (typeof languageApi?.toggleLanguage === 'function') {
      languageApi.toggleLanguage()
      return
    }

    if (typeof languageApi?.setLanguage === 'function') {
      languageApi.setLanguage(nextLanguage)
      return
    }

    if (typeof languageApi?.changeLanguage === 'function') {
      languageApi.changeLanguage(nextLanguage)
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
        className="min-h-screen overflow-hidden bg-gradient-to-b from-slate-50 via-white to-blue-50"
      >
        <section className="relative mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
          <div className="absolute left-1/2 top-16 -z-10 h-96 w-96 -translate-x-1/2 rounded-full bg-blue-200/40 blur-3xl" />

          <div className="mb-10 flex justify-end">
            <button
              type="button"
              onClick={handleLanguageToggle}
              className="inline-flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:border-primary hover:text-primary"
            >
              <Globe2 className="h-4 w-4" />
              {isArabic ? 'English' : 'العربية'}
            </button>
          </div>

          <div className="mx-auto max-w-4xl text-center">
            <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-blue-100 bg-white px-4 py-2 text-sm font-medium text-primary shadow-sm">
              <Sparkles className="h-4 w-4" />
              {t('landing.eyebrow')}
            </div>

            <h1 className="mt-6 text-5xl font-extrabold tracking-tight text-slate-950 sm:text-6xl lg:text-7xl">
              {t('landing.headlineLine1')}
              <br />
              <span className="text-primary">{t('landing.headlineLine2')}</span>
            </h1>

            <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-slate-600">
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

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-sm text-slate-600">
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
                className="rounded-2xl border border-slate-200 bg-white/80 p-6 text-center shadow-sm backdrop-blur"
              >
                <div className="text-3xl font-extrabold text-slate-950">
                  {item.value}
                </div>
                <div className="mt-1 text-sm text-slate-500">{item.label}</div>
              </div>
            ))}
          </div>

          <div className="mt-20 grid gap-6 md:grid-cols-3">
            {steps.map((step) => (
              <div
                key={step.title}
                className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm transition-all duration-300 hover:-translate-y-2 hover:shadow-xl"
              >
                <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <step.icon className="h-6 w-6" />
                </div>

                <h3 className="text-lg font-bold text-slate-950">
                  {t(step.title)}
                </h3>

                <p className="mt-3 text-sm leading-6 text-slate-600">
                  {t(step.description)}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-20 rounded-3xl border border-slate-200 bg-white p-8 shadow-sm sm:p-12">
            <div className="text-center">
              <h2 className="text-3xl font-extrabold tracking-tight text-slate-950">
                How TalentVerify works
              </h2>
              <p className="mx-auto mt-3 max-w-2xl text-slate-600">
                A private verification workflow built for candidates and approved HR organizations.
              </p>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-4">
              {workflow.map((item, index) => (
                <div key={item} className="rounded-2xl bg-slate-50 p-6">
                  <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                    {index + 1}
                  </div>
                  <h3 className="font-semibold text-slate-950">{item}</h3>
                </div>
              ))}
            </div>
          </div>

          <div className="mt-16 rounded-3xl bg-slate-950 p-8 text-center text-white shadow-xl sm:p-12">
            <LockKeyhole className="mx-auto h-10 w-10 text-blue-300" />
            <h2 className="mt-4 text-2xl font-bold">
              {t('landing.notSocialTitle')}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-slate-300">
              {t('landing.notSocialDescription')}
            </p>
          </div>

          <footer className="mt-20 border-t border-slate-200 py-8 text-center">
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-slate-500">
              <Link to="/privacy-policy" className="hover:text-primary">
                Privacy Policy
              </Link>
              <Link to="/terms" className="hover:text-primary">
                Terms & Conditions
              </Link>
              <Link to="/cookie-policy" className="hover:text-primary">
                Cookie Policy
              </Link>
              <Link to="/verification-policy" className="hover:text-primary">
                Verification Policy
              </Link>
            </div>

            <p className="mt-4 text-sm text-slate-400">
              © 2026 TalentVerify. All rights reserved.
            </p>
          </footer>
        </section>
      </main>
    </PublicShell>
  )
}