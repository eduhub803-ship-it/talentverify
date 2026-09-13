import { useContext } from 'react'
import { Link } from 'react-router-dom'
import { LanguageContext } from '@/context/LanguageContext'

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
            {language === 'ar'
              ? '© 2026 Talent Verify. جميع الحقوق محفوظة.'
              : '© 2026 Talent Verify. All rights reserved.'}
          </p>
          <p className="mt-2 text-slate-400">
            {language === 'ar'
              ? 'DRAFT — سياسات قيد المراجعة القانونية'
              : 'DRAFT — Policies under legal review'}
          </p>
        </div>
      </div>
    </footer>
  )
}
