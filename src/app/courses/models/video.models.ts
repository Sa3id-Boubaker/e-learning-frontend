export interface VideoResponse {
  id: string;
  chapterId: string;
  title: string;
  description: string | null;
  // Present only when the viewer is enrolled — absent (not an error) otherwise. Everything
  // else on this response (title, duration, order) is always present regardless of enrollment.
  videoUrl?: string;
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
