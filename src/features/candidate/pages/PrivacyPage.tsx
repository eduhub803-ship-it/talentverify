import { useCallback, useEffect, useState, useContext } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageContext } from '@/context/LanguageContext'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/features/shared/components/ui/Button'
import { Link } from 'react-router-dom'
import { formatDate } from '@/lib/utils'

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
  const t = langCtx?.t ?? ((key: string) => key)
  const isRTL = language === 'ar'

  const [candidate, setCandidateProfile] = useState<CandidateProfile | null>(null)
  const [prefs, setPrefs] = useState<NotificationPrefs | null>(null)
  const [consents, setConsents] = useState<Consent[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: string; text: string } | null>(null)

  const loadData = useCallback(async () => {
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
  }, [profile])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadData])

  const notificationOptions: { key: keyof NotificationPrefs; label: string }[] = [
    { key: 'job_alerts', label: t('privacy.jobAlerts') },
    { key: 'application_updates', label: t('privacy.applicationUpdates') },
    { key: 'employer_contact', label: t('privacy.employerContact') },
    { key: 'career_services', label: t('privacy.careerServices') },
    { key: 'account_updates', label: t('privacy.accountUpdates') },
  ]

  const handleVisibilityToggle = async () => {
    if (!profile?.id || !candidate || !supabase) return
    try {
      setSaving(true)
      const newValue = !candidate.employer_visible
      await supabase.from('candidate_profiles').update({ employer_visible: newValue }).eq('user_id', profile.id)
      setCandidateProfile({ ...candidate, employer_visible: newValue })
      setMessage({
        type: 'success',
        text: newValue ? t('privacy.message.visible') : t('privacy.message.hidden'),
      })
      setTimeout(() => setMessage(null), 4000)
    } catch (err) {
      console.error('Error:', err)
      setMessage({ type: 'error', text: t('privacy.message.visibilityFailed') })
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
      setMessage({ type: 'success', text: t('privacy.message.preferenceUpdated') })
      setTimeout(() => setMessage(null), 2000)
    } catch (err) {
      console.error('Error:', err)
      setMessage({ type: 'error', text: t('privacy.message.preferenceFailed') })
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-slate-600">{t('privacy.loading')}</div>
  }

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
        <h1 className="text-3xl font-bold text-slate-900">{t('privacy.title')}</h1>
        <p className="mt-2 text-slate-600">{t('privacy.description')}</p>
      </div>

      {/* Employer Visibility */}
      <div className="rounded-lg border border-slate-200 p-6">
        <div className="flex items-center justify-between gap-4">
          <div className="flex-1">
            <h2 className="text-lg font-semibold text-slate-900">
              {t('privacy.employerVisibility')}
            </h2>
            <p className="mt-1 text-sm text-slate-600">
              {t('privacy.employerVisibilityDesc')}
            </p>
            <div className="mt-3 rounded-lg bg-blue-50 p-3 text-sm text-blue-700">
              <p>{t('privacy.visibilityWarning')}</p>
            </div>
          </div>
          <div className={`flex flex-shrink-0 items-center gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
            <span className="text-sm font-medium text-slate-700">
              {candidate?.employer_visible ? t('status.visible') : t('status.hidden')}
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
              <h3 className="font-semibold text-slate-900">{t('privacy.canSee')}</h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">
                <li>{t('privacy.skillsExperience')}</li>
                <li>{t('privacy.education')}</li>
                <li>{t('privacy.projects')}</li>
                <li>{t('privacy.verificationStatus')}</li>
              </ul>
            </div>
            <div className="rounded bg-slate-50 p-4">
              <h3 className="font-semibold text-slate-900">{t('privacy.cannotSee')}</h3>
              <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-slate-600">
                <li>{t('privacy.personalEmail')}</li>
                <li>{t('privacy.internalNotes')}</li>
                <li>{t('privacy.serviceHistory')}</li>
                <li>{t('privacy.rejectionReasons')}</li>
              </ul>
            </div>
          </div>
        )}
      </div>

      {/* Notification Preferences */}
      {prefs && (
        <div className="rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            {t('privacy.notificationPrefs')}
          </h2>
          <div className="mt-4 space-y-3">
            {notificationOptions.map(({ key, label }) => (
              <label key={key} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  checked={prefs[key]}
                  onChange={(e) => handlePrefChange(key, e.target.checked)}
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
              <span className="font-medium text-slate-700">{t('privacy.marketing')}</span>
            </label>
            <p className="mt-1 text-xs text-slate-500">
              {t('privacy.marketingHint')}
            </p>
          </div>
        </div>
      )}

      {/* Consent History */}
      {consents.length > 0 && (
        <div className="rounded-lg border border-slate-200 p-6">
          <h2 className="text-lg font-semibold text-slate-900">
            {t('privacy.consentHistory')}
          </h2>
          <div className="mt-4 space-y-2">
            {consents.map((consent) => (
              <div key={consent.policy_key} className="flex items-center justify-between rounded bg-slate-50 p-3 text-sm">
                <div>
                  <div className="font-medium text-slate-900">
                    {getPolicyName(consent.policy_key, t)}
                  </div>
                  <div className="text-xs text-slate-500">
                    v{consent.policy_version} •{' '}
                    {formatDate(consent.accepted_at, language)}
                  </div>
                </div>
                <div className="text-xs font-medium text-emerald-700">
                  {t('privacy.accepted')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-wrap gap-3 border-t pt-6">
        <Link to="/candidate/settings/my-data">
          <Button variant="secondary">{t('privacy.myData')}</Button>
        </Link>
        <Link to="/candidate/settings/delete-account">
          <Button variant="secondary" className="text-red-600 hover:bg-red-50">
            {t('privacy.deleteAccount')}
          </Button>
        </Link>
      </div>
    </div>
  )
}

function getPolicyName(key: string, t: (translationKey: string) => string): string {
  const translationKey = `privacy.policy.${key}`
  const translated = t(translationKey)
  return translated === translationKey ? key : translated
}
