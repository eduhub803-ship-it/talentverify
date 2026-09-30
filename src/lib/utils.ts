import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

type DateLanguage = 'en' | 'ar'

function resolveDateLocale(language?: DateLanguage) {
  const activeLanguage =
    language ??
    (typeof document !== 'undefined' && document.documentElement.lang === 'ar'
      ? 'ar'
      : 'en')
  return activeLanguage === 'ar' ? 'ar-JO' : 'en-US'
}

export function formatDate(
  iso: string | null | undefined,
  language?: DateLanguage,
): string {
  if (!iso) return '—'
  return new Intl.DateTimeFormat(resolveDateLocale(language), {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(iso))
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}
