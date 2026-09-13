import { useEffect, useState, useContext } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageContext } from '@/context/LanguageContext'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/features/shared/components/ui/Button'

type Step = 'info' | 'confirm' | 'submitted'

interface DeletionRequest {
  status: string
  requested_at: string
}

export function DeleteAccountPage() {
  const profile = useAuthStore((s) => s.profile)
  const langCtx = useContext(LanguageContext)
  const language = langCtx?.lang || 'en'
  const isRTL = language === 'ar'

  const [step, setStep] = useState<Step>('info')
  const [reason, setReason] = useState('')
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [request, setRequest] = useState<DeletionRequest | null>(null)

  useEffect(() => {
    checkExistingRequest()
  }, [profile?.id])

  const checkExistingRequest = async () => {
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
  }

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
      alert(language === 'ar' ? 'خطأ في الطلب' : 'Error submitting request')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-slate-600">Loading...</div>
  }

  const t = getTranslations(language)

  if (step === 'submitted' && request) {
    return (
      <div className={`space-y-6 py-8 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
        <div className="rounded-lg bg-blue-50 p-6 text-blue-700">
          <h2 className="text-lg font-semibold">{t.submitted}</h2>
          <p className="mt-2 text-sm">{t.submittedDesc}</p>
        </div>

        <div className="rounded-lg bg-slate-100 p-4">
          <p className="font-medium text-slate-700">
            {language === 'ar' ? 'الحالة: ' : 'Status: '}
            <span className="font-bold">{getStatusLabel(request.status, language)}</span>
          </p>
          <p className="mt-1 text-xs text-slate-600">
            {language === 'ar' ? 'في: ' : 'Requested: '}
            {new Date(request.requested_at).toLocaleDateString(
              language === 'ar' ? 'ar-JO' : 'en-US'
            )}
          </p>
        </div>
      </div>
    )
  }

  if (step === 'confirm') {
    return (
      <div className={`space-y-6 py-8 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
        <div>
          <h1 className="text-3xl font-bold text-slate-900">{t.title}</h1>
        </div>

        <div className="rounded-lg bg-red-50 p-4 text-red-700">
          <p className="font-semibold">⚠️ {language === 'ar' ? 'تحذير' : 'Warning'}</p>
          <p className="mt-2 text-sm">{t.warning}</p>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-900">{t.reason}</label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t.placeholder}
            className="mt-2 w-full rounded-lg border border-slate-300 p-3 text-sm"
            rows={4}
          />
        </div>

        <div className={`flex gap-3 ${isRTL ? 'flex-row-reverse' : ''}`}>
          <Button onClick={() => setStep('info')} variant="secondary">
            {t.cancel}
          </Button>
          <Button
            onClick={handleRequestDeletion}
            disabled={submitting}
            className="bg-red-600 hover:bg-red-700 text-white"
          >
            {submitting ? 'Submitting...' : t.confirm}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className={`space-y-6 py-8 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{t.title}</h1>
        <p className="mt-2 text-slate-600">{t.description}</p>
      </div>

      <div className="rounded-lg bg-yellow-50 p-4 text-yellow-700">
        <p className="text-sm">{t.warning}</p>
      </div>

      <div className="space-y-3">
        <h3 className="font-semibold text-slate-900">
          {language === 'ar' ? 'ما الذي سيحدث:' : 'What will happen:'}
        </h3>
        <ul className="space-y-2 text-sm text-slate-600">
          <li>✓ {language === 'ar' ? 'سيتم منع الوصول إلى حسابك' : 'Your account access will be prevented'}</li>
          <li>✓ {language === 'ar' ? 'سيتم جعل ملفك الشخصي خاصاً' : 'Your profile will be made private'}</li>
          <li>✓ {language === 'ar' ? 'سيقوم الأدمن بمراجعة طلبك' : 'Admins will review your request'}</li>
          <li>✓ {language === 'ar' ? 'سيتم حذف بيانات الحساب بعد الموافقة' : 'Your data will be deleted after approval'}</li>
        </ul>
      </div>

      <Button
        onClick={() => setStep('confirm')}
        className="bg-red-600 hover:bg-red-700 text-white"
      >
        {t.requestDeletion}
      </Button>
    </div>
  )
}

function getTranslations(lang: string) {
  const translations = {
    en: {
      title: 'Delete Account',
      description:
        'Request permanent deletion of your account. This will be reviewed by administrators.',
      warning:
        'Deleting your account will: immediately prevent login, make your profile private, and require admin approval before permanent deletion.',
      reason: 'Reason for deletion (optional)',
      placeholder: 'Tell us why you are deleting your account...',
      confirm: 'Confirm Deletion',
      cancel: 'Cancel',
      submitted: 'Your deletion request has been submitted',
      submittedDesc: 'Admins will review your request. You will receive updates via email.',
      requestDeletion: 'Request Deletion',
    },
    ar: {
      title: 'حذف الحساب',
      description: 'طلب حذف حسابك بشكل دائم. سيتم مراجعة هذا من قبل المسؤولين.',
      warning:
        'حذف حسابك سيؤدي إلى: منع تسجيل الدخول فوراً، وجعل ملفك الشخصي خاصاً، وتطلب موافقة الأدمن قبل الحذف الدائم.',
      reason: 'سبب الحذف (اختياري)',
      placeholder: 'أخبرنا لماذا تحذف حسابك...',
      confirm: 'تأكيد الحذف',
      cancel: 'إلغاء',
      submitted: 'تم تقديم طلب الحذف',
      submittedDesc: 'سيقوم الأدمن بمراجعة طلبك. ستتلقى تحديثات عبر البريد الإلكتروني.',
      requestDeletion: 'طلب الحذف',
    },
  }
  return translations[lang as keyof typeof translations] || translations.en
}

function getStatusLabel(status: string, lang: string): string {
  const labels: Record<string, Record<string, string>> = {
    en: {
      requested: 'Pending Admin Review',
      under_review: 'Under Review',
      approved: 'Approved',
      completed: 'Completed',
      rejected: 'Rejected',
    },
    ar: {
      requested: 'في انتظار مراجعة الأدمن',
      under_review: 'قيد المراجعة',
      approved: 'موافق عليه',
      completed: 'مكتمل',
      rejected: 'مرفوض',
    },
  }
  return labels[lang]?.[status] || status
}
