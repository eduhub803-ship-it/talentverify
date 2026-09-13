import { useEffect, useState, useContext } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageContext } from '@/context/LanguageContext'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/features/shared/components/ui/Button'
import { Link } from 'react-router-dom'

interface CandidateProfile {
  employer_visible: boolean
}

interface NotificationPrefs {
  job_alerts: boolean
  application_updates: boolean
  employer_contact: boolean
  career_services: boolean
  account_updates: boolean
  marketing_communications: boolean
}

interface Consent {
  policy_key: string
  policy_version: string
  accepted_at: string
}

export function PrivacyPage() {
  const profile = useAuthStore((s) => s.profile)
  const langCtx = useContext(LanguageContext)
  const language = langCtx?.lang || 'en'
  const isRTL = language === 'ar'

  const [candidate, setCandidateProfile] = useState<CandidateProfile | null>(null)
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null)
  const [consents, setConsents] = useState<Consent[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null)

  useEffect(() => {
    loadData()
  }, [profile?.id])

  const loadData = async () => {
    if (!profile?.id || !supabase) return
    try {
      setLoading(true)
      const [profRes, prefRes, consentRes] = await Promise.all([
        supabase.from('candidate_profiles').select('employer_visible').eq('user_id', profile.id).single(),
        supabase.from('notification_preferences').select('*').eq('user_id', profile.id).single(),
        supabase.from('user_consents').select('*').eq('user_id', profile.id),
      ])

      if (profRes.data) setCandidateProfile(profRes.data)
      if (prefRes.data) setPrefs(prefRes.data)
      if (consentRes.data) setConsents(consentRes.data)
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleVisibilityToggle = async () => {
    if (!profile?.id || !candidate || !supabase) return
    try {
      setSaving(true)
      const newValue = !candidate.employer_visible
      await supabase.from('candidate_profiles').update({ employer_visible: newValue }).eq('user_id', profile.id)
      setCandidateProfile({ ...candidate, employer_visible: newValue })
      setMessage({
        type: 'success',
        text: newValue ? 'Profile is now visible to employers' : 'Profile is now hidden from employers',
      })
      setTimeout(() => setMessage(null), 4000)
    } catch (err) {
      console.error('Error:', err)
      setMessage({ type: 'error', text: 'Failed to update visibility' })
    } finally {
      setSaving(false)
    }
  }

  const handlePrefChange = async (key: keyof NotificationPrefs, value: boolean) => {
    if (!profile?.id || !prefs || !supabase) return
    try {
      setSaving(true)
      const updated = { ...prefs, [key]: value }
      await supabase.from('notification_preferences').update(updated).eq('user_id', profile.id)
      setPrefs(updated)
      setMessage({ type: 'success', text: 'Preference updated' })
      setTimeout(() => setMessage(null), 2000)
    } catch (err) {
      console.error('Error:', err)
      setMessage({ type: 'error', text: 'Failed to update preference' })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-slate-600">Loading settings...</div>
  }

  const t = getTranslations(language)

  return (
    <div className={`space-y-8 py-8 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      {message && (
        <div
          className={`rounded-lg p-4 text-sm ${
            message.type === 'success'
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-red-50 text-red-700'
          }`}
        >
          {message.text}
        </div>
      )}

      <div>
        <h1 className="text-3xl font-bold text-slate-900">{t.title}</h1>
        <p className="mt-2 text-slate-600">{t.description}</p>
      </div>

      {/* Employer Visibility */}
      <div className="rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900">{t.employerVisibility}</h2>
            <p className="mt-1 text-sm text-slate-600">{t.employerVisibilityDesc}</p>
            <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
              <p>{t.visibilityWarning}</p>
            </div>
          </div>
          <div className={`flex flex-shrink-0 items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="text-sm font-medium text-slate-700">
              {candidate?.employer_visible ? 'Visible' : 'Hidden'}
            </span>
            <button
              onClick={handleVisibilityToggle}
              disabled={saving}
              className={`relative inline-flex h-8 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                candidate?.employer_visible ? 'bg-emerald-600' : 'bg-slate-300'
              } ${saving ? 'opacity-50 cursor-not-allowed' : ''}`}
            >
              <span
                className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow-lg ring-0 transition-transform ${
                  candidate?.employer_visible ? 'translate-x-7' : 'translate-x-0'
                } ${isRTL ? '-translate-x-7 translate-x-0' : ''}`}
              />
            </button>
          </div>
        </div>

        {candidate?.employer_visible && (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            <div className="rounded bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-900">{t.canSee}</h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">
                <li>{language === 'ar' ? 'المهارات والخبرة' : 'Skills & Experience'}</li>
                <li>{language === 'ar' ? 'التعليم' : 'Education'}</li>
                <li>{language === 'ar' ? 'المشاريع' : 'Projects'}</li>
                <li>{language === 'ar' ? 'حالة التحقق' : 'Verification Status'}</li>
              </ul>
            </div>
            <div className="rounded bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-900">{t.cannotSee}</h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">
                <li>{language === 'ar' ? 'البريد الإلكتروني الشخصي' : 'Personal Email'}</li>
                <li>{language === 'ar' ? 'ملاحظات داخلية' : 'Internal Notes'}</li>
                <li>{language === 'ar' ? 'سجل الخدمات' : 'Service History'}</li>
                <li>{language === 'ar' ? 'أسباب الرفض' : 'Rejection Reasons'}</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Notification Preferences */}
      {prefs && (
        <div className="rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900">{t.notifPrefs}</h2>
          <div className="mt-4 space-y-3">
            {[
              { key: 'job_alerts', label: t.jobAlerts },
              { key: 'application_updates', label: t.appUpdates },
              { key: 'employer_contact', label: t.employerContact },
              { key: 'career_services', label: t.careerServices },
              { key: 'account_updates', label: t.accountUpdates },
            ].map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={(prefs as any)[key]}
                  onChange={(e) => handlePrefChange(key as keyof NotificationPrefs, e.target.checked)}
                  disabled={saving}
                  className="h-4 w-4 rounded"
                />
                <span className="text-sm text-slate-700">{label}</span>
              </label>
            ))}
          </div>

          <div className="mt-4 border-t pt-4">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                checked={prefs.marketing_communications}
                onChange={(e) => handlePrefChange('marketing_communications', e.target.checked)}
                disabled={saving}
                className="h-4 w-4 rounded"
              />
              <span className="font-medium text-slate-700">{t.marketing}</span>
            </label>
            <p className="mt-1 text-xs text-slate-500">
              {language === 'ar' ? 'اختياري — أنت المسيطر عليه' : 'Optional — you control this'}
            </p>
          </div>
        </div>
      )}

      {/* Consent History */}
      {consents.length > 0 && (
        <div className="rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            {language === 'ar' ? 'سجل الموافقة' : 'Consent History'}
          </h2>
          <div className="mt-4 space-y-2">
            {consents.map((consent) => (
              <div key={consent.policy_key} className="flex items-center justify-between rounded bg-slate-50 p-3 text-sm">
                <div>
                  <div className="font-medium text-slate-900">
                    {getPolicyName(consent.policy_key, language)}
                  </div>
                  <div className="text-xs text-slate-500">
                    v{consent.policy_version} •{' '}
                    {new Date(consent.accepted_at).toLocaleDateString(
                      language === 'ar' ? 'ar-JO' : 'en-US'
                    )}
                  </div>
                </div>
                <div className="text-xs font-medium text-emerald-700">
                  {language === 'ar' ? 'موافق' : 'Accepted'}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 border-t pt-6">
        <Link to="/candidate/settings/my-data">
          <Button variant="secondary">{t.myData}</Button>
        </Link>
        <Link to="/candidate/settings/delete-account">
          <Button variant="secondary" className="text-red-600 hover:bg-red-50">
            {t.deleteAccount}
          </Button>
        </Link>
      </div>
    </div>
  )
}

function getTranslations(lang: string) {
  const translations = {
    en: {
      title: 'Privacy & Data Settings',
      description: 'Manage your privacy preferences and notification settings',
      employerVisibility: 'Employer Visibility',
      employerVisibilityDesc: 'Control whether employers can discover your professional profile',
      visibilityWarning:
        'When enabled, your verified profile may appear in employer searches. You can change this anytime.',
      canSee: 'Employers can see:',
      cannotSee: 'Employers cannot see:',
      notifPrefs: 'Notification Preferences',
      jobAlerts: 'Job Alerts',
      appUpdates: 'Application Updates',
      employerContact: 'Employer Messages',
      careerServices: 'Career Services Updates',
      accountUpdates: 'Account Updates',
      marketing: 'Marketing Communications (opt-in)',
      myData: 'View My Data',
      deleteAccount: 'Delete Account',
    },
    ar: {
      title: 'إعدادات الخصوصية والبيانات',
      description: 'إدارة تفضيلات الخصوصية وإعدادات الإخطارات',
      employerVisibility: 'رؤية صاحب العمل',
      employerVisibilityDesc: 'تحكم في ما إذا كان بإمكان أصحاب العمل اكتشاف ملفك المهني',
      visibilityWarning:
        'عند التفعيل، قد يظهر ملفك المتحقق منه في بحث صاحب العمل. يمكنك تغيير هذا في أي وقت.',
      canSee: 'يمكن لأصحاب العمل أن يروا:',
      cannotSee: 'لا يمكن لأصحاب العمل أن يروا:',
      notifPrefs: 'تفضيلات الإخطارات',
      jobAlerts: 'تنبيهات الوظائف',
      appUpdates: 'تحديثات الطلبات',
      employerContact: 'رسائل صاحب العمل',
      careerServices: 'تحديثات خدمات التطور الوظيفي',
      accountUpdates: 'تحديثات الحساب',
      marketing: 'الاتصالات التسويقية (اختياري)',
      myData: 'عرض بيانات الحساب',
      deleteAccount: 'حذف الحساب',
    },
  }
  return translations[lang as keyof typeof translations] || translations.en
}

function getPolicyName(key: string, language: string): string {
  const names = {
    en: {
      terms_of_service: 'Terms & Conditions',
      privacy_policy: 'Privacy Policy',
      candidate_data_policy: 'Candidate Data Policy',
      employer_data_policy: 'Employer Data Policy',
      data_retention_deletion: 'Data Retention Policy',
      acceptable_use: 'Acceptable Use Policy',
    },
    ar: {
      terms_of_service: 'الشروط والأحكام',
      privacy_policy: 'سياسة الخصوصية',
      candidate_data_policy: 'سياسة بيانات المرشح',
      employer_data_policy: 'سياسة بيانات صاحب العمل',
      data_retention_deletion: 'سياسة الاحتفاظ بالبيانات',
      acceptable_use: 'سياسة الاستخدام المقبول',
    },
  }
  return (names[language as keyof typeof names]?.[key as keyof (typeof names.en)] || key)
}
