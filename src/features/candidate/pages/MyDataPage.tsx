import { useEffect, useState, useContext } from 'react'
import { useAuthStore } from '@/stores/auth-store'
import { LanguageContext } from '@/context/LanguageContext'
import { supabase } from '@/lib/supabase/client'
import { Button } from '@/features/shared/components/ui/Button'

export function MyDataPage() {
  const profile = useAuthStore((s) => s.profile)
  const langCtx = useContext(LanguageContext)
  const language = langCtx?.lang || 'en'
  const isRTL = language === 'ar'

  const [data, setData] = useState<Record<string, any> | null>(null)
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    loadData()
  }, [profile?.id])

  const loadData = async () => {
    if (!profile?.id || !supabase) return
    try {
      setLoading(true)
      const [
        profRes,
        candRes,
        docsRes,
        appRes,
        csRes,
      ] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', profile.id).single(),
        supabase.from('candidate_profiles').select('*').eq('user_id', profile.id).single(),
        supabase.from('documents').select('*').eq('candidate_id', profile.id),
        supabase.from('applications').select('*').eq('candidate_id', profile.id),
        supabase.from('career_service_requests').select('*').eq('candidate_id', profile.id),
      ])

      setData({
        profile: profRes.data,
        candidate: candRes.data,
        documents: docsRes.data || [],
        applications: appRes.data || [],
        careerServices: csRes.data || [],
      })
    } catch (err) {
      console.error('Error loading data:', err)
    } finally {
      setLoading(false)
    }
  }

  const handleExport = () => {
    if (!data || !profile) return
    try {
      setExporting(true)
      const exportData = {
        exportDate: new Date().toISOString(),
        userId: profile.id,
        ...data,
      }
      const json = JSON.stringify(exportData, null, 2)
      const blob = new Blob([json], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `talentverify-data-${new Date().toISOString().split('T')[0]}.json`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error('Error exporting:', err)
    } finally {
      setExporting(false)
    }
  }

  if (loading) {
    return <div className="py-12 text-center text-slate-600">Loading your data...</div>
  }

  const t = getTranslations(language)

  return (
    <div className={`space-y-8 py-8 ${isRTL ? 'text-right' : 'text-left'}`} dir={isRTL ? 'rtl' : 'ltr'}>
      <div>
        <h1 className="text-3xl font-bold text-slate-900">{t.title}</h1>
        <p className="mt-2 text-slate-600">{t.description}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Section
          title={t.profile}
          data={data?.profile}
          expand={language === 'en'}
        />
        <Section
          title={t.candidate}
          data={data?.candidate}
          expand={language === 'en'}
        />
        <Section
          title={t.documents}
          data={{ count: data?.documents?.length || 0 }}
          expand={false}
        />
        <Section
          title={t.applications}
          data={{ count: data?.applications?.length || 0 }}
          expand={false}
        />
      </div>

      <div className="flex gap-3 border-t pt-6">
        <Button onClick={handleExport} disabled={exporting}>
          {exporting ? 'Exporting...' : 'Export as JSON'}
        </Button>
      </div>
    </div>
  )
}

function Section({
  title,
  data,
  expand = false,
}: {
  title: string
  data: any
  expand?: boolean
}) {
  const [expanded, setExpanded] = useState(expand)
  const hasData = data && Object.keys(data).length > 0

  return (
    <div className="rounded-lg border p-4">
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between text-left font-semibold text-slate-900"
      >
        <span>{title}</span>
        <span className="text-sm text-slate-500">{expanded ? '▼' : '▶'}</span>
      </button>
      {expanded && (
        <div className="mt-3">
          {hasData ? (
            <pre className="max-h-48 overflow-y-auto rounded bg-slate-50 p-3 text-xs text-slate-700">
              {JSON.stringify(data, null, 2)}
            </pre>
          ) : (
            <p className="text-sm text-slate-500">No data</p>
          )}
        </div>
      )}
    </div>
  )
}

function getTranslations(lang: string) {
  const translations = {
    en: {
      title: 'My Data',
      description: 'View and export your personal information',
      profile: 'Profile',
      candidate: 'Talent Passport',
      documents: 'Documents',
      applications: 'Applications',
    },
    ar: {
      title: 'بيانات الحساب',
      description: 'عرض وتصدير معلومات شخصية',
      profile: 'الملف الشخصي',
      candidate: 'جواز سفر الموهبة',
      documents: 'المستندات',
      applications: 'الطلبات',
    },
  }
  return translations[lang as keyof typeof translations] || translations.en
}
