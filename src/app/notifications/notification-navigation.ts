import { NotificationResponse } from './models/notification.models';

/**
 * Only 'COURSE' and 'FORUM_POST' have a frontend destination so far — any other referenceType
 * (including future ones added on the backend before this file is updated for them) or a
 * missing reference intentionally resolves to `null`, meaning "mark as read only, don't navigate".
 */
export function getNotificationRoute(notification: NotificationResponse): string[] | null {
  if (notification.referenceType === 'COURSE' && notification.referenceId) {
    return ['/courses', notification.referenceId];
  }

  if (notification.referenceType === 'FORUM_POST' && notification.referenceId) {
    return ['/forum', notification.referenceId];
  }

  return null;
}
