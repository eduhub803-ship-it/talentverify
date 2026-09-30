import { useContext } from 'react'
import { Link } from 'react-router-dom'
import { LanguageContext } from '@/context/LanguageContext'

export function Footer() {
  const langCtx = useContext(LanguageContext)
  const language = langCtx?.lang || 'en'
  const t = langCtx?.t ?? ((key: string) => key)
  const isRTL = language === 'ar'

  const links = [
    { label: t('footer.privacy'), href: '/legal/privacy' },
    { label: t('footer.terms'), href: '/legal/terms' },
    { label: t('footer.dataPolicy'), href: '/legal/data-policy' },
    {
      label: t('footer.employerData'),
      href: '/legal/employer-data-policy',
    },
    {
      label: t('footer.acceptableUse'),
      href: '/legal/acceptable-use',
    },
    {
      label: t('footer.dataRetention'),
      href: '/legal/data-retention',
    },
  ]

  return (
    <footer
      className={`border-t bg-slate-50 py-8 ${isRTL ? 'text-right' : 'text-left'}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div
          className={`flex flex-wrap gap-6 ${isRTL ? 'justify-end' : 'justify-start'}`}
        >
          {links.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="text-sm text-slate-600 hover:text-slate-900 hover:underline transition-colors"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="mt-6 border-t pt-6 text-xs text-slate-500">
          <p>
            {t('footer.rights')}
          </p>
          <p className="mt-2 text-slate-400">
            {t('footer.legalDraft')}
          </p>
        </div>
      </div>
    </footer>
  )
}
