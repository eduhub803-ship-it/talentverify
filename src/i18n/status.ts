type TFunction = (key: string) => string

type StatusContext = 'generic' | 'verification' | 'application'

const genericStatusKeys: Record<string, string> = {
  accepted: 'status.accepted',
  approved: 'status.approved',
  claimed: 'status.claimed',
  closed: 'status.closed',
  completed: 'status.completed',
  declined: 'status.declined',
  draft: 'status.draft',
  hidden: 'status.hidden',
  imported: 'status.imported',
  open: 'status.open',
  pending: 'status.pending',
  rejected: 'status.rejected',
  requested: 'status.requested',
  under_review: 'status.underReview',
  verified: 'status.verified',
  visible: 'status.visible',
}

const verificationStatusKeys: Record<string, string> = {
  ...genericStatusKeys,
  pending: 'status.pendingReview',
  under_review: 'status.underReview',
}

const applicationStatusKeys: Record<string, string> = {
  ...genericStatusKeys,
  pending: 'status.underReview',
  rejected: 'status.notSelected',
}

function humanizeStatus(status: string) {
  return status
    .split('_')
    .filter(Boolean)
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(' ')
}

export function translateStatus(
  status: string | null | undefined,
  t: TFunction,
  context: StatusContext = 'generic',
) {
  if (!status) return t('common.unknown')

  const keys =
    context === 'verification'
      ? verificationStatusKeys
      : context === 'application'
        ? applicationStatusKeys
        : genericStatusKeys
  const key = keys[status]
  if (!key) return humanizeStatus(status)

  const translated = t(key)
  return translated === key ? humanizeStatus(status) : translated
}
