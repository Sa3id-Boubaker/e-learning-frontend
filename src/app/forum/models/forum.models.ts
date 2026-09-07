export type ForumPostType = 'COURSE' | 'TRAINING';

export interface ForumAuthorSummary {
  id: string;
  firstName: string;
  lastName: string;
  profileImage: string | null;
  role: string;
}

export interface ForumReferenceSummary {
  id: string;
  title: string;
}

export interface ForumPostResponse {
  id: string;
  title: string;
  body: string;
  type: ForumPostType;
  author: ForumAuthorSummary;
  // Only one trio (course/chapter/video OR training/liveSession/recording) is non-null, per type.
  course: ForumReferenceSummary | null;
  chapter: ForumReferenceSummary | null;
  video: ForumReferenceSummary | null;
  training: ForumReferenceSummary | null;
  liveSession: ForumReferenceSummary | null;
  recording: ForumReferenceSummary | null;
  commentCount: number;
  upvoteCount: number;
  bookmarked: boolean;
  upvoted: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface ForumPostCreateRequest {
  title: string;
  type: ForumPostType;
  body: string;
  courseId?: string;
  chapterId?: string;
  videoId?: string;
  trainingId?: string;
  liveSessionId?: string;
  recordingId?: string;
}

/** Partial update — title/body only. type and every reference id are immutable after creation. */
export interface ForumPostUpdateRequest {
  title?: string;
  body?: string;
}

export interface ForumCommentResponse {
  id: string;
  postId: string;
  author: ForumAuthorSummary;
  body: string;
  createdAt: string;
  updatedAt: string;
}

export interface ForumCommentCreateRequest {
  body: string;
}

export interface ForumCommentUpdateRequest {
  body: string;
}

/** ADMIN-only — global comment count across every post, for dashboard use. */
export interface ForumCommentsCountResponse {
  count: number;
}
