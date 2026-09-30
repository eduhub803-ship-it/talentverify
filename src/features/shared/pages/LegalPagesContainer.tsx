import { useEffect, useState, useContext } from 'react'
import { useParams, Navigate } from 'react-router-dom'
import { LanguageContext } from '@/context/LanguageContext'
import { supabase } from '@/lib/supabase/client'

const POLICY_ROUTES: Record<string, string> = {
  privacy: 'privacy_policy',
  terms: 'terms_of_service',
  'data-policy': 'candidate_data_policy',
  'employer-data-policy': 'employer_data_policy',
  'data-retention': 'data_retention_deletion',
  'acceptable-use': 'acceptable_use',
}

interface Policy {
  title_en: string
  title_ar: string
  content_en: string
  content_ar: string
  effective_date: string
  last_updated_date: string
  version: string
}

export function LegalPagesContainer() {
  const { page } = useParams<{ page: string }>()
  const langCtx = useContext(LanguageContext)
  const language = langCtx?.lang || 'en'
  const [policy, setPolicy] = useState<Policy | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    loadPolicy()
  }, [page])

  const loadPolicy = async () => {
    if (!page || !supabase) {
      setError('Invalid page')
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const policyKey = POLICY_ROUTES[page]
      if (!policyKey) {
        setError('Policy not found')
        return
      }

      const { data, error: fetchError } = await supabase
        .from('privacy_policies')
        .select('*')
        .eq('policy_key', policyKey)
        .eq('is_active', true)
        .order('version', { ascending: false })
        .limit(1)
        .single()

      if (fetchError) {
        console.error('Fetch error:', fetchError)
        setError('Could not load policy')
        return
      }

      if (!data) {
        setError('Policy not found')
        return
      }

      setPolicy(data)
    } catch (err) {
      console.error('Error loading policy:', err)
      setError('Failed to load policy')
    } finally {
      setLoading(false)
    }
  }

  if (!page || !POLICY_ROUTES[page]) {
    return <Navigate to="/" replace />
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12 text-center">
        <div className="text-slate-600">Loading policy...</div>
      </div>
    )
  }

  if (error || !policy) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-12">
        <div className="rounded-lg bg-red-50 p-6 text-red-700">
          <h2 className="font-semibold">Error</h2>
          <p className="mt-2 text-sm">{error || 'Policy not found'}</p>
        </div>
      </div>
    )
  }

  const title = language === 'ar' ? policy.title_ar : policy.title_en
  const content = language === 'ar' ? policy.content_ar : policy.content_en
  const isRTL = language === 'ar'

  return (
    <div
      className={`min-h-screen bg-white py-12 ${isRTL ? 'text-right' : 'text-left'}`}
      dir={isRTL ? 'rtl' : 'ltr'}
    >
      <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-slate-900">{title}</h1>
          <div className={`mt-4 flex flex-col gap-2 text-sm text-slate-500 ${isRTL ? 'text-right' : 'text-left'}`}>
            <div>
              <span className="font-medium">
                {language === 'ar' ? 'الإصدار: ' : 'Version: '}
              </span>
              <span>{policy.version}</span>
            </div>
            <div>
              <span className="font-medium">
                {language === 'ar' ? 'ساري المفعول من: ' : 'Effective Date: '}
              </span>
              <span>
                {new Date(policy.effective_date).toLocaleDateString(
                  language === 'ar' ? 'ar-JO' : 'en-US',
                  { year: 'numeric', month: 'long', day: 'numeric' }
                )}
              </span>
            </div>
            <div>
              <span className="font-medium">
                {language === 'ar' ? 'آخر تحديث: ' : 'Last Updated: '}
              </span>
              <span>
                {new Date(policy.last_updated_date).toLocaleDateString(
                  language === 'ar' ? 'ar-JO' : 'en-US',
                  { year: 'numeric', month: 'long', day: 'numeric' }
                )}
              </span>
            </div>
          </div>
        </div>

        <div className="prose prose-slate max-w-none">
          <div className="whitespace-pre-line rounded-lg bg-slate-50 p-8 text-sm leading-relaxed text-slate-700">
            {content}
          </div>
        </div>

        <div className="mt-8 border-t pt-6">
          <p className="text-xs text-slate-500">
            {language === 'ar'
              ? 'للأسئلة أو المخاوف المتعلقة بالخصوصية، يرجى التواصل عبر صفحة الاتصال.'
              : 'For privacy questions or concerns, please use our contact page.'}
          </p>
        </div>
      </div>
    </div>
  )
}
