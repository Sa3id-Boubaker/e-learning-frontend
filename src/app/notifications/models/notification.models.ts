export interface NotificationResponse {
  id: string;
  // e.g. 'ENROLLMENT_ACTIVATED', 'TRAINING_ENROLLMENT_ACTIVATED', 'FORUM_TRAINING_POST',
  // 'FORUM_POST_COMMENT' — the backend keeps adding more, so this stays an open string, not a
  // union, and always falls back gracefully for unrecognized values.
  type: string;
  title: string;
  message: string;
  read: boolean;
  createdAt: string;
  // Both null for older notifications created before this field existed — same open-ended,
  // fall-back-gracefully treatment as `type`. Only 'COURSE' and 'FORUM_POST' have a frontend
  // destination so far (see notification-navigation.ts).
  referenceId?: string | null;
  referenceType?: string | null;
}

export interface UnreadCountResponse {
  count: number;
}

export interface MarkReadResponse {
  id: string;
  read: boolean;
}

export interface MarkAllReadResponse {
  updatedCount: number;
}
