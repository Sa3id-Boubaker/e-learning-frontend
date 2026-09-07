/**
 * Same spirit as courses/category-icon.ts: returns an antIcon `type` string, best-effort
 * matched against the backend's (open-ended, growing) notification type. Anything unrecognized
 * — including types added on the backend after this was written — falls back to a plain bell.
 */
export function getNotificationIcon(type: string): string {
  switch (type) {
    case 'ENROLLMENT_ACTIVATED':
      return 'check-circle';
    case 'FORUM_TRAINING_POST':
    case 'FORUM_POST_COMMENT':
      return 'message';
    default:
      return 'bell';
  }
}
