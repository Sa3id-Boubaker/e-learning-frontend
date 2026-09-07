export type CompletedVideoIds = string[];

export interface StudentProgressResponse {
  id: string | null;
  courseId: string;
  completedVideoIds: CompletedVideoIds;
  completedVideosCount: number;
  totalVideosCount: number;
  progressPercentage: number;
  completed: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}
