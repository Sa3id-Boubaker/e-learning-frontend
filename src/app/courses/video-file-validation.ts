export const ALLOWED_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime'];
export const MAX_VIDEO_SIZE_BYTES = 500 * 1024 * 1024;

export function validateVideoFile(file: File): string | null {
  if (!ALLOWED_VIDEO_TYPES.includes(file.type)) {
    return 'Only video files are allowed (mp4, webm, mov).';
  }

  if (file.size > MAX_VIDEO_SIZE_BYTES) {
    return 'File size exceeds the 500MB limit.';
  }

  return null;
}
