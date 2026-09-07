export interface ChapterResponse {
  id: string;
  courseId: string;
  title: string;
  description: string | null;
  order: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterCreateRequest {
  title: string;
  description?: string;
  order: number;
}

export interface ChapterUpdateRequest {
  title?: string;
  description?: string;
  order?: number;
}
