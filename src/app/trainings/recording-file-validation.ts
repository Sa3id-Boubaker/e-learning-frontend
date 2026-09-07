export const ALLOWED_RECORDING_VIDEO_TYPES = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska'];

// No client-side size cap here on purpose — the backend's max is configurable server-side
// ("currently a few GB"), so an oversized file is left to the server's own 400 response rather
// than guessing a number here that could drift out of sync with it.
export function validateRecordingFile(file: File): string | null {
  if (!ALLOWED_RECORDING_VIDEO_TYPES.includes(file.type)) {
    return 'Only video files are allowed (mp4, webm, mov, avi, mkv).';
  }

  return null;
}
