export const ALLOWED_AVATAR_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
export const MAX_AVATAR_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export function validateAvatarFile(file: File): string | null {
  if (!ALLOWED_AVATAR_IMAGE_TYPES.includes(file.type)) {
    return 'Only image files are allowed (jpg, jpeg, png, gif, webp).';
  }

  if (file.size > MAX_AVATAR_IMAGE_SIZE_BYTES) {
    return 'File size exceeds the 10MB limit.';
  }

  return null;
}
