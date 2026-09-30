import { useContext } from 'react'
import { Link } from 'react-router-dom'
import { LanguageContext } from '@/context/LanguageContext'
import { BrandLogo } from '@/features/shared/components/brand/BrandLogo'
import { BRAND } from '@/features/shared/brand'

export function Footer() {
  const langCtx = useContext(LanguageContext)
  const language = langCtx?.lang || 'en'
  const isRTL = language === 'ar'

  const links = [
    { label: language === 'ar' ? 'الخصوصية' : 'Privacy', href: '/legal/privacy' },
    { label: language === 'ar' ? 'الشروط والأحكام' : 'Terms', href: '/legal/terms' },
    { label: language === 'ar' ? 'سياسة البيانات' : 'Data Policy', href: '/legal/data-policy' },
    {
      label: language === 'ar' ? 'سياسة بيانات صاحب العمل' : 'Employer Data',
      href: '/legal/employer-data-policy',
    },
    {
      label: language === 'ar' ? 'الاستخدام المقبول' : 'Acceptable Use',
      href: '/legal/acceptable-use',
    },
    {
      label: language === 'ar' ? 'الاحتفاظ بالبيانات' : 'Data Retention',
      href: '/legal/data-retention',
    },
  ]

  return (
    <footer
      className={`border-t border-border bg-white py-8 ${isRTL ? 'text-right' : 'text-left'}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className={`mb-6 flex ${isRTL ? 'justify-end' : 'justify-start'}`}>
          <BrandLogo variant="logo" imgClassName="h-8 w-auto" />
        </div>
        <div
          className={`flex flex-wrap gap-6 ${isRTL ? 'justify-end' : 'justify-start'}`}
        >
          {links.map((link) => (
            <Link
              key={link.href}
              to={link.href}
              className="text-sm text-muted transition-colors hover:text-primary hover:underline"
            >
              {link.label}
            </Link>
          ))}
        </div>

        <div className="mt-6 border-t border-border pt-6 text-xs text-muted">
          <p>
            {language === 'ar'
              ? `© 2026 ${BRAND.name}. جميع الحقوق محفوظة.`
              : `© 2026 ${BRAND.name}. All rights reserved.`}
          </p>
          <p className="mt-2 text-muted/75">
            {language === 'ar'
              ? 'DRAFT - سياسات قيد المراجعة القانونية'
              : 'DRAFT - Policies under legal review'}
          </p>
        </div>
      </div>
    </footer>
  )
}
