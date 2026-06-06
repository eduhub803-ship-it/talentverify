import { useContext } from 'react'
import { Link } from 'react-router-dom'
import { ArrowRight, BadgeCheck, Building2, Search, Shield } from 'lucide-react'
import { PublicShell } from '@/features/shared/components/layout/AppShell'
import { Button } from '@/features/shared/components/ui/Button'
import { Card, CardBody } from '@/features/shared/components/ui/Card'
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

export function LandingPage() {
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)

  return (
    <PublicShell>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-sm font-medium text-primary">{t('landing.eyebrow')}</p>
          <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground sm:text-5xl">
            {t('landing.headlineLine1')}
            <br />
            {t('landing.headlineLine2')}
          </h1>
          <p className="mt-6 text-lg text-muted">
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
        </div>

        <div className="mt-20 grid gap-6 md:grid-cols-3">
          {steps.map((step) => (
            <Card key={step.title}>
              <CardBody>
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary">
                  <step.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-foreground">{t(step.title)}</h3>
                <p className="mt-2 text-sm text-muted">{t(step.description)}</p>
              </CardBody>
            </Card>
          ))}
        </div>

        <div className="mt-24 rounded-2xl border border-border bg-white p-8 text-center shadow-sm sm:p-12">
          <h2 className="text-2xl font-semibold text-foreground">
            {t('landing.notSocialTitle')}
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-muted">
            {t('landing.notSocialDescription')}
          </p>
        </div>
      </section>
    </PublicShell>
  )
}
