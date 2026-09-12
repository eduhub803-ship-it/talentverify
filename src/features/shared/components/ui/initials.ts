/**
 * Two-letter fallback from the name, or the email as a last resort. Only the
 * local part of an email is used, so the domain never leaks into initials.
 *
 * Kept out of Avatar.tsx so that file only exports components.
 */
export function initialsOf(name: string | null | undefined, email?: string | null): string {
  const trimmedName = name?.trim() ?? ''
  const source = trimmedName || (email?.trim().split('@')[0] ?? '')
  if (!source) return '?'

  const parts = source.split(/[\s._-]+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
