import { useContext, useState } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import { Button } from '@/features/shared/components/ui/Button'
import { Input } from '@/features/shared/components/ui/Input'
import { LanguageContext } from '@/context/LanguageContext'
import type { CareerService, CareerServiceRequest } from '@/types/domain'
import { deliverableKeyFor, referenceOptions, validateServiceInput } from '../rules'
import { getCareerService } from '../catalog'

/**
 * Renders a service's declared inputs. Anything already stored in the Talent
 * Passport arrives prefilled, so the candidate is never asked for it twice.
 */
export function ServiceRequestForm({
  service,
  initialValues,
  prompt,
  submitLabel,
  isSubmitting,
  myRequests,
  onSubmit,
  onCancel,
}: {
  service: CareerService
  initialValues: Record<string, string>
  prompt?: string | null
  submitLabel: string
  isSubmitting: boolean
  /** Used to populate `reference` fields with the candidate's own results. */
  myRequests: CareerServiceRequest[]
  onSubmit: (values: Record<string, string>, notes: string) => void
  onCancel: () => void
}) {
  const language = useContext(LanguageContext)
  const t = language?.t ?? ((key: string) => key)
  const isArabic = language?.lang === 'ar'
  const [values, setValues] = useState<Record<string, string>>(() => ({ ...initialValues }))
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const setValue = (key: string, value: string) => {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => {
      if (!current[key]) return current
      const next = { ...current }
      delete next[key]
      return next
    })
  }

  const handleSubmit = () => {
    const validation = validateServiceInput(service, values)
    if (!validation.valid) {
      setErrors(validation.errors)
      return
    }
    onSubmit(values, notes)
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-lg font-semibold text-foreground">
          {isArabic ? service.nameAr : service.name}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {isArabic ? service.descriptionAr : service.description}
        </p>
        <p className="mt-2 text-sm font-medium text-foreground">
          {t(deliverableKeyFor(service))}
        </p>
      </div>

      {service.selfService && (
        <p className="rounded-lg border border-border bg-slate-50 px-3 py-2 text-xs text-muted">
          {t('careerServices.selfAssessmentNote')}
        </p>
      )}

      {prompt && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{prompt}</span>
        </div>
      )}

      <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted">
        <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
        <span>{t('careerServices.passportReuseNote')}</span>
      </div>

      <div className="space-y-4">
        {service.inputFields.map((field) => {
          const label = isArabic ? field.labelAr : field.label
          const value = values[field.key] ?? ''
          const help = isArabic ? field.helpTextAr : field.helpText

          if (field.type === 'boolean') {
            return (
              <div key={field.key} className="space-y-1.5">
                <p className="text-sm font-medium text-foreground">
                  {label}
                  {field.required && ' *'}
                </p>
                <div className="flex gap-2">
                  {[
                    { value: 'true', label: t('careerServices.yes') },
                    { value: 'false', label: t('careerServices.no') },
                  ].map((option) => (
                    <Button
                      key={option.value}
                      type="button"
                      size="sm"
                      variant={value === option.value ? 'primary' : 'secondary'}
                      aria-pressed={value === option.value}
                      onClick={() => setValue(field.key, option.value)}
                    >
                      {option.label}
                    </Button>
                  ))}
                </div>
                {errors[field.key] && (
                  <p className="text-xs text-red-600">{errors[field.key]}</p>
                )}
              </div>
            )
          }

          if (field.type === 'reference') {
            const options = referenceOptions(field, myRequests)
            const referenced = getCareerService(field.referenceServiceCode ?? '')
            return (
              <div key={field.key} className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  {label}
                  {field.required && ' *'}
                </label>
                <select
                  className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm"
                  value={value}
                  onChange={(event) => setValue(field.key, event.target.value)}
                >
                  <option value="">{t('careerServices.choose')}</option>
                  {options.map((option) => (
                    <option key={option.id} value={option.id}>
                      {(isArabic ? referenced?.nameAr : referenced?.name) ?? ''} —{' '}
                      {option.candidateInput.targetRole || option.id.slice(0, 8)}
                      {option.completedAt ? ` (${option.completedAt.slice(0, 10)})` : ''}
                    </option>
                  ))}
                </select>
                {help && <p className="text-xs text-muted">{help}</p>}
                {errors[field.key] && (
                  <p className="text-xs text-red-600">{errors[field.key]}</p>
                )}
              </div>
            )
          }

          if (field.type === 'select') {
            return (
              <div key={field.key} className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  {label}
                  {field.required && ' *'}
                </label>
                <select
                  className="h-10 w-full rounded-lg border border-border bg-white px-3 text-sm"
                  value={value}
                  onChange={(event) => setValue(field.key, event.target.value)}
                >
                  <option value="">{t('careerServices.choose')}</option>
                  {field.options?.map((option) => (
                    <option key={option.value} value={option.value}>
                      {isArabic ? option.labelAr : option.label}
                    </option>
                  ))}
                </select>
                {errors[field.key] && (
                  <p className="text-xs text-red-600">{errors[field.key]}</p>
                )}
              </div>
            )
          }

          if (field.type === 'textarea') {
            return (
              <div key={field.key} className="space-y-1.5">
                <label className="block text-sm font-medium text-foreground">
                  {label}
                  {field.required && ' *'}
                </label>
                <textarea
                  className="min-h-[110px] w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
                  value={value}
                  onChange={(event) => setValue(field.key, event.target.value)}
                />
                {help && <p className="text-xs text-muted">{help}</p>}
                {errors[field.key] && (
                  <p className="text-xs text-red-600">{errors[field.key]}</p>
                )}
              </div>
            )
          }

          return (
            <Input
              key={field.key}
              label={`${label}${field.required ? ' *' : ''}`}
              placeholder={field.placeholder}
              hint={help}
              error={errors[field.key]}
              value={value}
              onChange={(event) => setValue(field.key, event.target.value)}
            />
          )
        })}

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-foreground">
            {t('careerServices.additionalNotes')}
          </label>
          <textarea
            className="min-h-[80px] w-full rounded-lg border border-border bg-white px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>
      </div>

      {service.pricingType !== 'free' && (
        <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-muted">
          {t('careerServices.paymentNote')}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Button type="button" isLoading={isSubmitting} onClick={handleSubmit}>
          {submitLabel}
        </Button>
        <Button type="button" variant="secondary" disabled={isSubmitting} onClick={onCancel}>
          {t('careerServices.cancel')}
        </Button>
      </div>
    </div>
  )
}
