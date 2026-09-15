export interface VideoResponse {
  id: string;
  chapterId: string;
  title: string;
  description: string | null;
  // Present only when the viewer is enrolled — absent (not an error) otherwise. Everything
  // else on this response (title, duration, order) is always present regardless of enrollment.
  videoUrl?: string;
  // Genere automatiquement par l'add-on Cloudinary "Google AI Video Transcription" (raw_convert:
  // google_speech) — absent tant que la transcription n'est pas terminee ou si l'add-on n'est
  // pas active sur le compte Cloudinary. Meme regle de presence/masquage que videoUrl.
  subtitleUrl?: string;
  duration: number | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface VideoCreateRequest {
  title: string;
  description?: string;
  order: number;
  file: File;
}

export interface VideoUpdateRequest {
  title?: string;
  description?: string;
  order?: number;
}
