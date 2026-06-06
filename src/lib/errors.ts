export class UsageLimitError extends Error {
  readonly code = 'USAGE_LIMIT_EXCEEDED'

  constructor(
    message = 'You have used all free CV evaluations. Upgrade to Pro for unlimited access.',
  ) {
    super(message)
    this.name = 'UsageLimitError'
  }
}

export class AuthorizationError extends Error {
  readonly code = 'FORBIDDEN'

  constructor(message = 'You are not authorized to perform this action.') {
    super(message)
    this.name = 'AuthorizationError'
  }
}
