/**
 * Avatar preparation.
 *
 * Photos are downscaled and re-encoded in the browser before they are stored,
 * so a phone photo never lands in Mock storage (or Supabase) at full size.
 */
export const AVATAR_MAX_BYTES = 4 * 1024 * 1024
export const AVATAR_EDGE_PX = 256
export const AVATAR_ACCEPT = 'image/png,image/jpeg,image/webp'

const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp']

export interface AvatarValidation {
  valid: boolean
  error: string | null
}

export function validateAvatarFile(file: File): AvatarValidation {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Choose a PNG, JPG or WebP image.' }
  }
  if (file.size > AVATAR_MAX_BYTES) {
    return { valid: false, error: 'The image must be smaller than 4MB.' }
  }
  return { valid: true, error: null }
}

/**
 * Centre-crops to a square and scales to AVATAR_EDGE_PX, returning a data URL.
 * Runs in the browser only; callers guard for environments without canvas.
 */
export async function prepareAvatar(file: File): Promise<string> {
  const validation = validateAvatarFile(file)
  if (!validation.valid) throw new Error(validation.error ?? 'Invalid image.')

  const bitmap = await createImageBitmap(file)
  const edge = Math.min(bitmap.width, bitmap.height)
  const sx = (bitmap.width - edge) / 2
  const sy = (bitmap.height - edge) / 2

  const canvas = document.createElement('canvas')
  canvas.width = AVATAR_EDGE_PX
  canvas.height = AVATAR_EDGE_PX
  const context = canvas.getContext('2d')
  if (!context) throw new Error('This browser cannot process images.')

  context.drawImage(bitmap, sx, sy, edge, edge, 0, 0, AVATAR_EDGE_PX, AVATAR_EDGE_PX)
  bitmap.close?.()

  return canvas.toDataURL('image/jpeg', 0.85)
}
