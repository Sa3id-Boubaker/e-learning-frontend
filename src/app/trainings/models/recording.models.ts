export interface RecordingResponse {
  id: string;
  sessionId: string;
  title: string;
  description: string | null;
  videoUrl: string;
  // Seconds, always server-computed by Cloudinary — never editable, never sent in any request.
  duration: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecordingUpdateRequest {
  title?: string;
  description?: string;
}
