import { AuthorizationError } from '@/lib/errors'
import type { Profile } from '@/types/domain'
import { profileService } from './api/profile.service'
import { validateAvatarFile } from './avatar'

function assertSelf(actor: Profile | null | undefined, userId: string): Profile {
  if (!actor) {
    throw new AuthorizationError('You must be signed in to change your profile photo.')
  }
  if (actor.id !== userId) {
    throw new AuthorizationError('You can only change your own profile photo.')
  }
  return actor
}

/** Any signed-in user may set their own photo; nobody may set another's. */
export async function saveProfileAvatar(input: {
  actor: Profile | null
  userId: string
  /** Already prepared (cropped + downscaled) data URL. */
  dataUrl: string
}): Promise<Profile> {
  assertSelf(input.actor, input.userId)
  if (!input.dataUrl.startsWith('data:image/')) {
    throw new Error('That does not look like an image.')
  }
  return profileService.setAvatar(input.userId, input.dataUrl)
}

export async function removeProfileAvatar(input: {
  actor: Profile | null
  userId: string
}): Promise<Profile> {
  assertSelf(input.actor, input.userId)
  return profileService.setAvatar(input.userId, null)
}

export { validateAvatarFile }
