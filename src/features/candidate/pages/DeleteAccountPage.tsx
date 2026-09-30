import { useCallback, useEffect, useState, useContext } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageContext } from '@/context/LanguageContext'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/features/shared/components/ui/Button'
import { formatDate } from '@/lib/utils'
import { translateStatus } from '@/i18n/status'

type Step = 'info' | 'confirm' | 'submitted'

interface DeletionRequest {
  status: string
  requested_at: string
}

export function DeleteAccountPage() {
  const profile = useAuthStore((s) => s.profile)
  const langCtx = useContext(LanguageContext)
  const language = langCtx?.lang || 'en'
  const t = langCtx?.t ?? ((key: string) => key)
  const isRTL = language === 'ar'

  const [step, setStep] = useState<Step>('info')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [request, setRequest] = useState<DeletionRequest | null>(null)

  const checkExistingRequest = useCallback(async () => {
    if (!profile?.id || !supabase) {
      setLoading(false)
      return
    }
    try {
      const { data } = await supabase
        .from('deletion_requests')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (data) {
        setRequest(data)
        setStep('submitted')
      }
    } catch (err) {
      console.error('Error checking deletion request:', err)
    } finally {
      setLoading(false)
    }
  }, [profile])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void checkExistingRequest()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [checkExistingRequest])

  const handleRequestDeletion = async () => {
    if (!profile?.id || !supabase) return
    try {
      setSubmitting(true)
      const { error } = await supabase.from('deletion_requests').insert({
        user_id: profile.id,
        status: 'requested',
        metadata: { reason: reason || null },
      })

      if (error) throw error
      await checkExistingRequest()
    } catch (err) {
      console.error('Error:', err)
      alert(t('deleteAccount.submitError'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-slate-600">{t('common.loading')}</div>
  }

  if (step === 'submitted' && request) {
    return (
      <div className={`space-y-6 py-8 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="rounded-lg bg-blue-50 p-6 text-blue-700">
          <h2 className="text-lg font-semibold">{t('deleteAccount.submitted')}</h2>
          <p className="mt-2 text-sm">{t('deleteAccount.submittedDesc')}</p>
        </div>

        <div className="rounded-lg bg-slate-100 p-4">
          <p className="font-medium text-slate-700">
            {t('common.status')}{' '}
            <span className="font-bold">{translateStatus(request.status, t)}</span>
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {t('deleteAccount.requested')}{' '}
            {formatDate(request.requested_at, language)}
          </p>
        </div>
      </div>
    )
  }

  if (step === 'confirm') {
    return (
      <div className={`space-y-6 py-8 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t('deleteAccount.title')}</h1>
        </div>

        <div className="rounded-lg bg-red-50 p-4 text-red-700">
          <p className="font-semibold">⚠️ {t('common.warning')}</p>
          <p className="mt-2 text-sm">{t('deleteAccount.warning')}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-900">
            {t('deleteAccount.reason')}
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t('deleteAccount.placeholder')}
            className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm"
            rows={4}
          />
        </div>

        <div className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Button onClick={() => setStep('info')} variant="secondary">
            {t('common.cancel')}
          </Button>
          <Button
            onClick={handleRequestDeletion}
            disabled={submitting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {submitting ? t('common.submitting') : t('deleteAccount.confirm')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 py-8 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{t('deleteAccount.title')}</h1>
        <p className="mt-2 text-slate-600">{t('deleteAccount.description')}</p>
      </div>

      <div className="rounded-lg bg-yellow-50 p-4 text-yellow-700">
        <p className="text-sm">{t('deleteAccount.warning')}</p>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-slate-900">
          {t('deleteAccount.whatWillHappen')}
        </h3>
        <ul className="space-y-2 text-sm text-slate-600">
          <li>✓ {t('deleteAccount.preventAccess')}</li>
          <li>✓ {t('deleteAccount.privateProfile')}</li>
          <li>✓ {t('deleteAccount.adminReview')}</li>
          <li>✓ {t('deleteAccount.deleteAfterApproval')}</li>
        </ul>
      </div>

      <Button
        onClick={() => setStep('confirm')}
        className="bg-red-600 hover:bg-red-700 text-white"
      >
        {t('deleteAccount.requestDeletion')}
      </Button>
    </div>
  )
}
